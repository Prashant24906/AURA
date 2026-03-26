"""
isolation_forest.py
-------------------
Isolation Forest for streetlight anomaly detection.
Best for: real-time detection, scalable to thousands of lights.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from typing import Tuple, Dict, Any


class StreetlightIsolationForest:
    """
    Isolation Forest wrapper for streetlight failure detection.

    The model is trained on NORMAL readings only (unsupervised).
    At inference, readings with anomaly scores below `threshold`
    are flagged as failures.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        contamination: float = 0.08,
        max_features: float = 0.8,
        random_state: int = 42,
    ):
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            max_features=max_features,
            random_state=random_state,
            n_jobs=-1,
        )
        self.contamination = contamination
        self.threshold = 0.0        # learned from validation set
        self.feature_cols = None

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(
        self,
        df: pd.DataFrame,
        feature_cols: list,
        use_normal_only: bool = True,
    ) -> "StreetlightIsolationForest":
        """
        Fit scaler + Isolation Forest.

        Parameters
        ----------
        df            : full DataFrame (with is_failure column)
        feature_cols  : list of feature column names
        use_normal_only: if True, train only on normal readings (semi-supervised)
        """
        self.feature_cols = feature_cols

        if use_normal_only:
            train_df = df[df["is_failure"] == 0]
        else:
            train_df = df

        X_train = train_df[feature_cols].values
        X_scaled = self.scaler.fit_transform(X_train)

        print(f"[IsolationForest] Training on {len(X_train):,} samples "
              f"({'normal only' if use_normal_only else 'all'}) ...")
        self.model.fit(X_scaled)
        print("[IsolationForest] Training complete.")
        return self

    def tune_threshold(
        self,
        df_val: pd.DataFrame,
        feature_cols: list,
    ) -> float:
        """
        Find the optimal decision threshold on a labelled validation set
        by maximising F1 score.
        """
        X_val = self.scaler.transform(df_val[feature_cols].values)
        scores = self.model.score_samples(X_val)   # more negative = more anomalous

        best_f1, best_thresh = 0.0, 0.0
        for pct in np.linspace(1, 30, 60):
            t = np.percentile(scores, pct)
            preds = (scores < t).astype(int)
            f1 = f1_score(df_val["is_failure"].values, preds, zero_division=0)
            if f1 > best_f1:
                best_f1, best_thresh = f1, t

        self.threshold = best_thresh
        print(f"[IsolationForest] Best threshold: {best_thresh:.4f} | F1: {best_f1:.4f}")
        return best_thresh

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Return binary predictions (1 = failure, 0 = normal)."""
        X = self.scaler.transform(df[self.feature_cols].values)
        scores = self.model.score_samples(X)
        return (scores < self.threshold).astype(int)

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        """
        Return a [0, 1] anomaly probability derived from the raw score.
        Note: IForest doesn't output true probabilities — this is a
        monotonic transform useful for ranking / thresholding.
        """
        X = self.scaler.transform(df[self.feature_cols].values)
        scores = self.model.score_samples(X)
        # Normalise to [0, 1]: more negative → closer to 1
        normed = (scores - scores.max()) / (scores.min() - scores.max() + 1e-9)
        return np.clip(normed, 0, 1)

    def predict_with_details(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return a DataFrame with predictions, anomaly scores, and severity."""
        proba = self.predict_proba(df)
        preds = (proba > 0.5).astype(int)
        severity = pd.cut(
            proba,
            bins=[0, 0.4, 0.7, 0.9, 1.0],
            labels=["normal", "warning", "high", "critical"],
        )
        result = df.copy()
        result["anomaly_score"] = np.round(proba, 4)
        result["predicted_failure"] = preds
        result["severity"] = severity
        return result

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def evaluate(self, df: pd.DataFrame, feature_cols: list) -> Dict[str, Any]:
        preds = self.predict(df)
        y_true = df["is_failure"].values

        cm = confusion_matrix(y_true, preds)
        report = classification_report(y_true, preds, output_dict=True,
                                       target_names=["normal", "failure"])
        print("\n[IsolationForest] Evaluation")
        print("Confusion Matrix:\n", cm)
        print(classification_report(y_true, preds, target_names=["normal", "failure"]))
        return {"confusion_matrix": cm, "report": report}

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str = "models/iforest_streetlight.pkl") -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"scaler": self.scaler, "model": self.model,
                     "threshold": self.threshold, "feature_cols": self.feature_cols}, path)
        print(f"[IsolationForest] Saved → {path}")

    @classmethod
    def load(cls, path: str) -> "StreetlightIsolationForest":
        data = joblib.load(path)
        obj = cls()
        obj.scaler = data["scaler"]
        obj.model = data["model"]
        obj.threshold = data["threshold"]
        obj.feature_cols = data["feature_cols"]
        print(f"[IsolationForest] Loaded ← {path}")
        return obj


# ------------------------------------------------------------------
# Quick self-test
# ------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from data.data_generator import generate_dataset, engineer_features, FEATURE_COLS

    print("=== Isolation Forest — Streetlight Failure Detection ===\n")

    df = generate_dataset(n_lights=300, days=30, anomaly_rate=0.08, seed=42)
    df = engineer_features(df)

    # Only operate on nighttime (when lights should be on)
    df_night = df[df["is_operational_hour"] == 1].copy()

    train_df, test_df = train_test_split(df_night, test_size=0.2, random_state=42,
                                         stratify=df_night["is_failure"])

    clf = StreetlightIsolationForest(n_estimators=200, contamination=0.08)
    clf.fit(train_df, FEATURE_COLS, use_normal_only=True)
    clf.tune_threshold(test_df, FEATURE_COLS)
    clf.evaluate(test_df, FEATURE_COLS)

    # Sample detailed predictions
    sample = test_df.head(5)
    result = clf.predict_with_details(sample)
    print("\nDetailed predictions (sample):")
    print(result[["light_id", "timestamp", "brightness_lux",
                  "anomaly_score", "predicted_failure", "severity", "is_failure"]])

    clf.save("outputs/iforest_streetlight.pkl")