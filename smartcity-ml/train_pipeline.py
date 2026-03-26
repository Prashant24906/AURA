"""
train_pipeline.py
------------------
End-to-end training pipeline for all streetlight failure detection models.

Usage:
    python train_pipeline.py                     # train all models
    python train_pipeline.py --model iforest     # train one model
    python train_pipeline.py --help
"""

import argparse
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

# Local imports
sys.path.insert(0, str(Path(__file__).parent))
from data.data_generator import generate_dataset, engineer_features, FEATURE_COLS
from models.stlight import StreetlightIsolationForest
from models.classical_models import ZScoreDetector, LOFDetector
from utils.evaluation import (
    compute_metrics,
    compare_models,
    plot_confusion_matrix,
    plot_roc_pr,
    plot_feature_importance,
    permutation_importance,
    generate_alert_report,
    plot_brightness_series,
)

OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------------
# Dataset preparation
# ------------------------------------------------------------------

def prepare_data(
    n_lights: int = 500,
    days: int = 30,
    anomaly_rate: float = 0.08,
    noise_level: float = 1.0,
    seed: int = 42,
):
    print("\n" + "=" * 60)
    print("STEP 1 — Data generation & feature engineering")
    print("=" * 60)
    df = generate_dataset(
        n_lights=n_lights,
        days=days,
        anomaly_rate=anomaly_rate,
        noise_level=noise_level,
        seed=seed,
    )
    df = engineer_features(df)

    # Only nighttime readings (when lights should be on)
    df_night = df[df["is_operational_hour"] == 1].copy()
    print(f"\nNighttime subset: {len(df_night):,} rows | "
          f"{df_night['is_failure'].sum():,} failures "
          f"({df_night['is_failure'].mean()*100:.1f}%)")

    train_df, test_df = train_test_split(
        df_night, test_size=0.2, random_state=seed,
        stratify=df_night["is_failure"],
    )
    print(f"Train: {len(train_df):,} | Test: {len(test_df):,}")
    return df, train_df, test_df


# ------------------------------------------------------------------
# Individual model trainers
# ------------------------------------------------------------------

def train_isolation_forest(train_df, test_df):
    print("\n" + "=" * 60)
    print("STEP 2a — Isolation Forest")
    print("=" * 60)
    model = StreetlightIsolationForest(
        n_estimators=200, contamination=0.08, random_state=42
    )
    model.fit(train_df, FEATURE_COLS, use_normal_only=True)
    model.tune_threshold(test_df, FEATURE_COLS)
    model.evaluate(test_df, FEATURE_COLS)
    model.save(str(OUTPUT_DIR / "iforest_streetlight.pkl"))

    preds = model.predict(test_df)
    scores = model.predict_proba(test_df)
    metrics = compute_metrics(test_df["is_failure"].values, preds, scores)

    plot_confusion_matrix(
        test_df["is_failure"].values, preds,
        model_name="Isolation Forest",
        save_path=str(OUTPUT_DIR / "cm_iforest.png"),
    )
    return model, metrics, scores


def train_zscore(train_df, test_df):
    print("\n" + "=" * 60)
    print("STEP 2b — Z-Score Detector")
    print("=" * 60)
    model = ZScoreDetector(z_threshold=3.0)
    model.fit(train_df, FEATURE_COLS)
    model.tune_threshold(test_df)
    model.evaluate(test_df)
    model.save(str(OUTPUT_DIR / "zscore_streetlight.pkl"))

    result_df = model.predict_with_scores(test_df)
    preds = result_df["predicted_failure"].values
    scores = result_df["anomaly_score"].values
    metrics = compute_metrics(test_df["is_failure"].values, preds, scores)

    plot_confusion_matrix(
        test_df["is_failure"].values, preds,
        model_name="Z-Score",
        save_path=str(OUTPUT_DIR / "cm_zscore.png"),
    )
    return model, metrics, scores


def train_lof(train_df, test_df):
    print("\n" + "=" * 60)
    print("STEP 2c — Local Outlier Factor")
    print("=" * 60)
    model = LOFDetector(n_neighbors=20, contamination=0.08)
    model.fit(train_df, FEATURE_COLS)
    model.evaluate(test_df)
    model.save(str(OUTPUT_DIR / "lof_streetlight.pkl"))

    result_df = model.predict_with_scores(test_df)
    preds = result_df["predicted_failure"].values
    scores = result_df["anomaly_score"].values
    metrics = compute_metrics(test_df["is_failure"].values, preds, scores)

    plot_confusion_matrix(
        test_df["is_failure"].values, preds,
        model_name="LOF",
        save_path=str(OUTPUT_DIR / "cm_lof.png"),
    )
    return model, metrics, scores


def train_lstm(train_df, test_df):
    print("\n" + "=" * 60)
    print("STEP 2d — LSTM Autoencoder")
    print("=" * 60)
    try:
        from models.lstm_autoencoder import StreetlightLSTMAE
        model = StreetlightLSTMAE(
            seq_len=6, hidden_size=64, num_layers=2,
            epochs=20, batch_size=128, lr=1e-3,
        )
        model.fit(train_df, FEATURE_COLS, val_df=test_df)
        metrics_dict = model.evaluate(test_df)
        model.save(str(OUTPUT_DIR / "lstm_ae_streetlight.pt"))

        result_df = model.predict_with_scores(test_df)
        preds = result_df["predicted_failure"].values
        scores = result_df["anomaly_score"].values
        y_true = result_df["is_failure"].values
        metrics = compute_metrics(y_true, preds, scores)

        plot_confusion_matrix(
            y_true, preds,
            model_name="LSTM Autoencoder",
            save_path=str(OUTPUT_DIR / "cm_lstm.png"),
        )
        return model, metrics, scores, result_df
    except ImportError:
        print("[Pipeline] PyTorch not installed — skipping LSTM Autoencoder.")
        return None, None, None, None


# ------------------------------------------------------------------
# Full pipeline
# ------------------------------------------------------------------

def run_pipeline(args):
    df, train_df, test_df = prepare_data(
        n_lights=args.n_lights,
        days=args.days,
        anomaly_rate=args.anomaly_rate,
        noise_level=args.noise,
        seed=args.seed,
    )

    model_metrics = {}
    roc_data = {}
    best_model = None

    if args.model in ("all", "iforest"):
        iforest, m, s = train_isolation_forest(train_df, test_df)
        model_metrics["Isolation Forest"] = m
        roc_data["Isolation Forest"] = {"y_true": test_df["is_failure"].values, "y_score": s}
        best_model = iforest

    if args.model in ("all", "zscore"):
        _, m, s = train_zscore(train_df, test_df)
        model_metrics["Z-Score"] = m
        roc_data["Z-Score"] = {"y_true": test_df["is_failure"].values, "y_score": s}

    if args.model in ("all", "lof"):
        _, m, s = train_lof(train_df, test_df)
        model_metrics["LOF"] = m
        roc_data["LOF"] = {"y_true": test_df["is_failure"].values, "y_score": s}

    if args.model in ("all", "lstm"):
        lstm_model, m, s, lstm_result = train_lstm(train_df, test_df)
        if m is not None:
            model_metrics["LSTM-AE"] = m
            roc_data["LSTM-AE"] = {"y_true": lstm_result["is_failure"].values, "y_score": s}

    # ------------------------------------------------------------------
    # Step 3: Visualisations & reports
    # ------------------------------------------------------------------
    if len(model_metrics) > 1:
        print("\n" + "=" * 60)
        print("STEP 3 — Evaluation & reporting")
        print("=" * 60)
        _, _ = compare_models(model_metrics, save_path=str(OUTPUT_DIR / "model_comparison.png"))
        plot_roc_pr(roc_data, save_path=str(OUTPUT_DIR / "roc_pr_curves.png"))

    # Feature importance via permutation (on best model)
    if best_model is not None:
        print("\n[Pipeline] Computing feature importance ...")
        imp_df = permutation_importance(best_model, test_df, FEATURE_COLS, n_repeats=5)
        plot_feature_importance(
            imp_df,
            title="Feature Importance — Isolation Forest (Permutation)",
            save_path=str(OUTPUT_DIR / "feature_importance.png"),
        )
        print("\nTop features:\n", imp_df.head(8))

        # Alert report
        result_df = best_model.predict_with_details(test_df)
        generate_alert_report(
            result_df,
            prediction_col="predicted_failure",
            score_col="anomaly_score",
            top_n=20,
            save_path=str(OUTPUT_DIR / "alert_report.csv"),
        )

        # Brightness series plot for one light
        sample_light = test_df["light_id"].iloc[0]
        plot_brightness_series(
            result_df, light_id=sample_light,
            save_path=str(OUTPUT_DIR / "brightness_series.png"),
        )

    print("\n" + "=" * 60)
    print(f"Pipeline complete. Outputs → {OUTPUT_DIR.resolve()}")
    print("=" * 60)

    # Final summary table
    if model_metrics:
        print("\nFinal metrics summary:")
        for name, m in model_metrics.items():
            print(f"  {name:<20} Acc={m['accuracy']*100:.1f}%  "
                  f"P={m['precision']*100:.1f}%  R={m['recall']*100:.1f}%  "
                  f"F1={m['f1']*100:.1f}%")


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Streetlight Failure Detection — ML Training Pipeline"
    )
    parser.add_argument(
        "--model",
        choices=["all", "iforest", "zscore", "lof", "lstm"],
        default="all",
        help="Which model(s) to train (default: all)",
    )
    parser.add_argument("--n-lights", type=int, default=500,
                        help="Number of unique streetlights to simulate")
    parser.add_argument("--days", type=int, default=30,
                        help="Number of days to simulate")
    parser.add_argument("--anomaly-rate", type=float, default=0.08,
                        help="Fraction of nighttime readings that are failures")
    parser.add_argument("--noise", type=float, default=1.0,
                        help="Sensor noise level multiplier (1.0 = realistic)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()
    run_pipeline(args)