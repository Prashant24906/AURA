"""
data_generator.py
-----------------
Synthetic streetlight sensor data generator.
Simulates real-world brightness readings with configurable failure injection.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Tuple, Optional


FAILURE_TYPES = {
    "complete_outage":  {"lux_range": (0, 30),    "label": 0},
    "dim_failure":      {"lux_range": (30, 180),   "label": 1},
    "voltage_surge":    {"lux_range": (600, 900),  "label": 2},
    "flicker_fault":    {"lux_range": (50, 400),   "label": 3},
    "partial_dim":      {"lux_range": (180, 300),  "label": 4},
}


def _normal_lux(hour: int, noise: float = 1.0) -> float:
    """Return expected lux for a given hour with optional noise."""
    if 18 <= hour or hour < 6:
        base = np.random.normal(430, 20 * noise)
        return float(np.clip(base, 300, 600))
    else:
        # Daylight — lights off / very dim ambient
        return float(np.random.uniform(5, 35))


def _voltage_variance(hour: int, noise: float = 1.0) -> float:
    """Simulate voltage variance (higher during peak load hours)."""
    peak = 1.0 if 18 <= hour <= 22 else 0.3
    return float(np.random.normal(0.0, 2.5 * noise * (1 + peak)))


def _temperature(month: int, noise: float = 1.0) -> float:
    """Simulate ambient temperature (Celsius) by month."""
    seasonal = 15 + 12 * np.sin(2 * np.pi * (month - 3) / 12)
    return float(np.random.normal(seasonal, 3 * noise))


def _flicker_rate(is_failure: bool, ftype: Optional[str]) -> float:
    """Number of flicker events per minute."""
    if is_failure and ftype == "flicker_fault":
        return float(np.random.uniform(4.0, 12.0))
    elif is_failure:
        return float(np.random.uniform(0.5, 3.0))
    return float(np.random.uniform(0.0, 0.3))


def _on_off_cycles(is_failure: bool) -> int:
    if is_failure:
        return int(np.random.randint(3, 15))
    return int(np.random.randint(0, 2))


def generate_dataset(
    n_lights: int = 500,
    days: int = 30,
    anomaly_rate: float = 0.08,
    noise_level: float = 1.0,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate a synthetic dataset of streetlight readings.

    Parameters
    ----------
    n_lights    : number of unique streetlight IDs
    days        : number of days to simulate
    anomaly_rate: fraction of nighttime readings that are failures
    noise_level : scale multiplier for sensor noise (1.0 = realistic)
    seed        : random seed for reproducibility

    Returns
    -------
    pd.DataFrame with columns:
        light_id, timestamp, hour, month, day_of_week,
        brightness_lux, voltage_variance, temperature_c,
        flicker_rate, on_off_cycles, fixture_age_months,
        is_failure, failure_type, failure_label
    """
    np.random.seed(seed)
    records = []

    start_date = datetime(2024, 1, 1)
    failure_type_list = list(FAILURE_TYPES.keys())

    for light_id in range(n_lights):
        age_months = int(np.random.randint(1, 120))  # 1 month – 10 years

        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)
            month = current_date.month
            dow = current_date.weekday()

            for hour in range(24):
                ts = current_date + timedelta(hours=hour)
                is_night = (hour >= 18) or (hour < 6)

                # Inject failure only at night
                is_failure = is_night and (np.random.random() < anomaly_rate)
                ftype = np.random.choice(failure_type_list) if is_failure else None

                if is_failure:
                    lo, hi = FAILURE_TYPES[ftype]["lux_range"]
                    lux = float(np.random.uniform(lo, hi))
                    failure_label = FAILURE_TYPES[ftype]["label"]
                else:
                    lux = _normal_lux(hour, noise_level)
                    failure_label = -1  # normal

                records.append({
                    "light_id":         f"SL-{light_id:04d}",
                    "timestamp":        ts,
                    "hour":             hour,
                    "month":            month,
                    "day_of_week":      dow,
                    "brightness_lux":   round(lux, 2),
                    "voltage_variance": round(_voltage_variance(hour, noise_level), 4),
                    "temperature_c":    round(_temperature(month, noise_level), 2),
                    "flicker_rate":     round(_flicker_rate(is_failure, ftype), 3),
                    "on_off_cycles":    _on_off_cycles(is_failure),
                    "fixture_age_months": age_months,
                    "is_failure":       int(is_failure),
                    "failure_type":     ftype if ftype else "normal",
                    "failure_label":    failure_label,
                })

    df = pd.DataFrame(records)
    print(f"[DataGenerator] Generated {len(df):,} rows | "
          f"{df['is_failure'].sum():,} failures "
          f"({df['is_failure'].mean()*100:.1f}%)")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add derived features on top of raw sensor readings.

    New columns:
        lux_rolling_mean_3h, lux_rolling_std_3h,
        lux_z_score, lux_delta,
        is_operational_hour, expected_lux_range_ok
    """
    df = df.sort_values(["light_id", "timestamp"]).copy()

    # Per-light rolling stats (3-hour window)
    grp = df.groupby("light_id")["brightness_lux"]
    df["lux_rolling_mean_3h"] = grp.transform(lambda x: x.rolling(3, min_periods=1).mean())
    df["lux_rolling_std_3h"]  = grp.transform(lambda x: x.rolling(3, min_periods=1).std().fillna(0))

    # Z-score vs rolling mean
    df["lux_z_score"] = (
        (df["brightness_lux"] - df["lux_rolling_mean_3h"])
        / (df["lux_rolling_std_3h"] + 1e-6)
    )

    # First-order difference (brightness change from previous reading)
    df["lux_delta"] = grp.transform(lambda x: x.diff().fillna(0))

    # Is it expected to be on?
    df["is_operational_hour"] = ((df["hour"] >= 18) | (df["hour"] < 6)).astype(int)

    # Flag readings outside expected operational range
    df["expected_lux_range_ok"] = (
        ((df["is_operational_hour"] == 1) & (df["brightness_lux"].between(280, 550))) |
        ((df["is_operational_hour"] == 0) & (df["brightness_lux"] < 50))
    ).astype(int)

    return df


FEATURE_COLS = [
    "brightness_lux",
    "voltage_variance",
    "temperature_c",
    "flicker_rate",
    "on_off_cycles",
    "fixture_age_months",
    "lux_rolling_mean_3h",
    "lux_rolling_std_3h",
    "lux_z_score",
    "lux_delta",
    "is_operational_hour",
    "expected_lux_range_ok",
    "hour",
    "month",
    "day_of_week",
]


if __name__ == "__main__":
    df_raw = generate_dataset(n_lights=200, days=14, anomaly_rate=0.08, seed=42)
    df_feat = engineer_features(df_raw)
    df_feat.to_csv("/tmp/streetlight_data.csv", index=False)
    print(df_feat[FEATURE_COLS + ["is_failure"]].describe())
    print("\nSample rows:")
    print(df_feat[df_feat["is_failure"] == 1][["light_id", "timestamp", "brightness_lux", "failure_type"]].head(10))