"""
inference_api.py
----------------
FastAPI REST service for real-time streetlight failure detection.

Endpoints:
    POST /predict          — single reading
    POST /predict/batch    — batch of readings (up to 1000)
    GET  /health           — service health check
    GET  /model/info       — loaded model metadata

Run:
    uvicorn inference_api:app --host 0.0.0.0 --port 8000 --reload

Example curl:
    curl -X POST http://localhost:8000/predict \
      -H "Content-Type: application/json" \
      -d '{
        "light_id": "SL-0042",
        "brightness_lux": 45.0,
        "voltage_variance": -0.8,
        "temperature_c": 22.5,
        "flicker_rate": 0.1,
        "on_off_cycles": 0,
        "fixture_age_months": 36,
        "lux_rolling_mean_3h": 425.0,
        "lux_rolling_std_3h": 12.3,
        "lux_z_score": -2.8,
        "lux_delta": -380.0,
        "is_operational_hour": 1,
        "expected_lux_range_ok": 0,
        "hour": 22,
        "month": 6,
        "day_of_week": 2
      }'
"""

from pathlib import Path
from typing import List, Optional
import time

import numpy as np
import pandas as pd

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field, validator
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    print("[API] FastAPI not installed. Run: pip install fastapi uvicorn")

import sys
sys.path.insert(0, str(Path(__file__).parent))
from data.data_generator import FEATURE_COLS


# ------------------------------------------------------------------
# Pydantic schemas
# ------------------------------------------------------------------

class SensorReading(BaseModel):
    light_id: str = Field(..., example="SL-0042")
    brightness_lux: float = Field(..., ge=0, le=2000, description="Measured brightness in lux")
    voltage_variance: float = Field(0.0, description="Voltage deviation from nominal")
    temperature_c: float = Field(20.0, description="Ambient temperature in Celsius")
    flicker_rate: float = Field(0.0, ge=0, description="Flicker events per minute")
    on_off_cycles: int = Field(0, ge=0, description="On/off cycles in last hour")
    fixture_age_months: int = Field(24, ge=0, description="Fixture age in months")
    # Derived features (can be computed if not provided)
    lux_rolling_mean_3h: Optional[float] = None
    lux_rolling_std_3h: Optional[float] = None
    lux_z_score: Optional[float] = None
    lux_delta: Optional[float] = None
    is_operational_hour: Optional[int] = None
    expected_lux_range_ok: Optional[int] = None
    hour: Optional[int] = Field(None, ge=0, le=23)
    month: Optional[int] = Field(None, ge=1, le=12)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)

    @validator("brightness_lux")
    def lux_must_be_positive(cls, v):
        if v < 0:
            raise ValueError("brightness_lux must be ≥ 0")
        return v


class PredictionResponse(BaseModel):
    light_id: str
    predicted_failure: bool
    anomaly_score: float = Field(..., description="0 = normal, 1 = certain failure")
    severity: str = Field(..., description="normal | warning | high | critical")
    confidence: float
    inference_time_ms: float
    model_name: str


class BatchRequest(BaseModel):
    readings: List[SensorReading]


class BatchResponse(BaseModel):
    predictions: List[PredictionResponse]
    total_readings: int
    failures_detected: int
    inference_time_ms: float


# ------------------------------------------------------------------
# Feature filling helper
# ------------------------------------------------------------------

def fill_derived_features(reading: "SensorReading") -> dict:
    """
    Fill derived features with reasonable defaults if not provided.
    In production, maintain a per-light state cache instead.
    """
    from datetime import datetime
    now = datetime.utcnow()
    hour = reading.hour if reading.hour is not None else now.hour
    month = reading.month if reading.month is not None else now.month
    dow = reading.day_of_week if reading.day_of_week is not None else now.weekday()
    is_op = int(hour >= 18 or hour < 6)
    mean_3h = reading.lux_rolling_mean_3h if reading.lux_rolling_mean_3h is not None else reading.brightness_lux
    std_3h = reading.lux_rolling_std_3h if reading.lux_rolling_std_3h is not None else 10.0
    z = reading.lux_z_score if reading.lux_z_score is not None else (
        (reading.brightness_lux - mean_3h) / (std_3h + 1e-6)
    )
    delta = reading.lux_delta if reading.lux_delta is not None else 0.0
    in_range = int(
        (is_op == 1 and 280 <= reading.brightness_lux <= 550) or
        (is_op == 0 and reading.brightness_lux < 50)
    )

    return {
        "brightness_lux":       reading.brightness_lux,
        "voltage_variance":     reading.voltage_variance,
        "temperature_c":        reading.temperature_c,
        "flicker_rate":         reading.flicker_rate,
        "on_off_cycles":        reading.on_off_cycles,
        "fixture_age_months":   reading.fixture_age_months,
        "lux_rolling_mean_3h":  mean_3h,
        "lux_rolling_std_3h":   std_3h,
        "lux_z_score":          z,
        "lux_delta":            delta,
        "is_operational_hour":  is_op,
        "expected_lux_range_ok": in_range,
        "hour":                 hour,
        "month":                month,
        "day_of_week":          dow,
    }


def score_to_severity(score: float) -> str:
    if score < 0.4:  return "normal"
    if score < 0.7:  return "warning"
    if score < 0.9:  return "high"
    return "critical"


# ------------------------------------------------------------------
# App factory
# ------------------------------------------------------------------

def create_app(model_path: str = "outputs/iforest_streetlight.pkl") -> "FastAPI":
    if not FASTAPI_AVAILABLE:
        raise RuntimeError("FastAPI not installed. Run: pip install fastapi uvicorn")

    from models.isolation_forest import StreetlightIsolationForest

    app = FastAPI(
        title="Streetlight Failure Detection API",
        description="Real-time ML inference for streetlight brightness anomaly detection.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Load model at startup
    detector = None

    @app.on_event("startup")
    async def load_model():
        nonlocal detector
        p = Path(model_path)
        if p.exists():
            detector = StreetlightIsolationForest.load(str(p))
            print(f"[API] Model loaded from {p}")
        else:
            print(f"[API] WARNING: model not found at {p}. Run train_pipeline.py first.")

    @app.get("/health")
    def health():
        return {
            "status": "ok" if detector is not None else "degraded",
            "model_loaded": detector is not None,
        }

    @app.get("/model/info")
    def model_info():
        if detector is None:
            raise HTTPException(503, "Model not loaded")
        return {
            "model_type":    "Isolation Forest",
            "feature_count": len(detector.feature_cols or []),
            "features":      detector.feature_cols,
            "threshold":     round(detector.threshold, 6),
        }

    @app.post("/predict", response_model=PredictionResponse)
    def predict_single(reading: SensorReading):
        if detector is None:
            raise HTTPException(503, "Model not loaded")

        t0 = time.perf_counter()
        row = fill_derived_features(reading)
        df = pd.DataFrame([row])

        score = float(detector.predict_proba(df)[0])
        pred = score > 0.5
        elapsed = (time.perf_counter() - t0) * 1000

        return PredictionResponse(
            light_id=reading.light_id,
            predicted_failure=pred,
            anomaly_score=round(score, 4),
            severity=score_to_severity(score),
            confidence=round(abs(score - 0.5) * 2, 4),
            inference_time_ms=round(elapsed, 3),
            model_name="IsolationForest",
        )

    @app.post("/predict/batch", response_model=BatchResponse)
    def predict_batch(batch: BatchRequest):
        if detector is None:
            raise HTTPException(503, "Model not loaded")
        if len(batch.readings) > 1000:
            raise HTTPException(400, "Batch size exceeds maximum (1000)")

        t0 = time.perf_counter()
        rows = [fill_derived_features(r) for r in batch.readings]
        df = pd.DataFrame(rows)

        scores = detector.predict_proba(df)
        preds = (scores > 0.5).astype(bool)
        elapsed = (time.perf_counter() - t0) * 1000

        predictions = [
            PredictionResponse(
                light_id=batch.readings[i].light_id,
                predicted_failure=bool(preds[i]),
                anomaly_score=round(float(scores[i]), 4),
                severity=score_to_severity(float(scores[i])),
                confidence=round(abs(float(scores[i]) - 0.5) * 2, 4),
                inference_time_ms=round(elapsed / len(batch.readings), 3),
                model_name="IsolationForest",
            )
            for i in range(len(batch.readings))
        ]

        return BatchResponse(
            predictions=predictions,
            total_readings=len(predictions),
            failures_detected=int(preds.sum()),
            inference_time_ms=round(elapsed, 3),
        )

    return app


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

app = create_app() if FASTAPI_AVAILABLE else None

if __name__ == "__main__":
    if not FASTAPI_AVAILABLE:
        print("Install FastAPI: pip install fastapi uvicorn")
        sys.exit(1)
    import uvicorn
    uvicorn.run("inference_api:app", host="0.0.0.0", port=8000, reload=True)