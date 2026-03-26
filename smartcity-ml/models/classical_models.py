"""
classical_models.py
--------------------
Z-Score threshold and Local Outlier Factor models.

Z-Score   — simplest baseline; single-feature, fast, interpretable.
LOF       — density-based; works well when failures cluster spatially.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from typing import Dict, Optional


# ======================================================================
# Z-Score Threshold Detector
# ======================================================================

class ZScoreDetector:
    """
    Per-feature Z-score baseline.
    A reading is flagged as anomalous if any feature deviates more than
    `z_threshold` standard deviations from its mean.
    Simple, fast, interpretable — good minimum baseline.
    """

    def __init__(self, z_threshold: float = 3.0):
        self.z_threshold = z_threshold
        self.means_: Optional[np.ndarray] = None
        self.stds_: Optional[np.ndarray] = None
        self.feature_cols = None

    def fit(self, df: pd.DataFrame, feature_cols: list) -> "ZScoreDetector":
        self.feature_cols = feature_cols
        normal = df[df["is_failure"] == 0][feature_cols].values
        self.means_ = normal.mean(axis=0)
        self.stds_ = normal.std(axis=0) + 1e-9
        print(f"[ZScore] Fitted on {len(normal):,} normal samples.")
        return self

    def tune_threshold(self, df_val: pd.DataFrame) -> float:
        """Tune z_threshold on a validation set by maximising F1."""
        best_f1, best_z = 0.0, self.z_threshold
        for z in np.arange(1.5, 5.0, 0.1):
            old = self.z_threshold
            self.z_threshold = z
            preds = self.predict(df_val)
            f1 = f1_score(df_val["is_failure"].values, preds, zero_division=0)
            self.z_threshold = old
            if f1 > best_f1:
                best_f1, best_z = f1, z
        self.z_threshold = best_z
        print(f"[ZScore] Best z_threshold: {best_z:.1f} | F1: {best_f1:.4f}")
        return best_z

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        X = df[self.feature_cols].values
        z_scores = np.abs((X - self.means_) / self.stds_)
        return (z_scores.max(axis=1) > self.z_threshold).astype(int)

    def predict_with_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        X = df[self.feature_cols].values
        z_scores = np.abs((X - self.means_) / self.stds_)
        max_z = z_scores.max(axis=1)
        top_feat_idx = z_scores.argmax(axis=1)
        result = df.copy()
        result["anomaly_score"] = np.round(max_z / (max_z.max() + 1e-9), 4)
        result["max_z_score"] = np.round(max_z, 3)
        result["triggered_feature"] = [self.feature_cols[i] for i in top_feat_idx]
        result["predicted_failure"] = (max_z > self.z_threshold).astype(int)
        return result

    def evaluate(self, df: pd.DataFrame) -> Dict:
        preds = self.predict(df)
        y = df["is_failure"].values
        cm = confusion_matrix(y, preds)
        report = classification_report(y, preds, output_dict=True,
                                       target_names=["normal", "failure"])
        print("\n[ZScore] Evaluation")
        print("Confusion Matrix:\n", cm)
        print(classification_report(y, preds, target_names=["normal", "failure"]))
        return {"confusion_matrix": cm, "report": report}

    def save(self, path: str = "outputs/zscore_streetlight.pkl") -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.__dict__, path)
        print(f"[ZScore] Saved → {path}")

    @classmethod
    def load(cls, path: str) -> "ZScoreDetector":
        obj = cls()
        obj.__dict__.update(joblib.load(path))
        print(f"[ZScore] Loaded ← {path}")
        return obj


# ======================================================================
# Local Outlier Factor Detector
# ======================================================================

class LOFDetector:
    """
    Local Outlier Factor for streetlight anomaly detection.

    LOF compares the local density of a sample to that of its
    k nearest neighbours. Low density compared to neighbours = outlier.

    Note: scikit-learn's LOF does not support standard predict() after fit();
    we use fit_predict() on the entire dataset, with novelty=True for
    inference on held-out data.
    """

    def __init__(
        self,
        n_neighbors: int = 20,
        contamination: float = 0.08,
        metric: str = "minkowski",
        novelty: bool = True,
    ):
        self.n_neighbors = n_neighbors
        self.contamination = contamination
        self.metric = metric
        self.novelty = novelty
        self.scaler = StandardScaler()
        self.model: Optional[LocalOutlierFactor] = None
        self.feature_cols = None

    def fit(self, df: pd.DataFrame, feature_cols: list) -> "LOFDetector":
        self.feature_cols = feature_cols
        normal_df = df[df["is_failure"] == 0]
        X = self.scaler.fit_transform(normal_df[feature_cols].values)

        self.model = LocalOutlierFactor(
            n_neighbors=self.n_neighbors,
            contamination=self.contamination,
            metric=self.metric,
            novelty=self.novelty,
            n_jobs=-1,
        )
        print(f"[LOF] Fitting on {len(X):,} normal samples "
              f"(k={self.n_neighbors}, contamination={self.contamination}) ...")
        self.model.fit(X)
        print("[LOF] Training complete.")
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Returns 1 for failure, 0 for normal."""
        X = self.scaler.transform(df[self.feature_cols].values)
        # LOF returns -1 for outliers, 1 for inliers
        raw = self.model.predict(X)
        return (raw == -1).astype(int)

    def predict_with_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        X = self.scaler.transform(df[self.feature_cols].values)
        raw_preds = self.model.predict(X)
        # score_samples returns negative LOF scores; more negative = more anomalous
        lof_scores = self.model.score_samples(X)
        # Invert and normalise to [0, 1]
        normed = (-lof_scores - (-lof_scores).min()) / ((-lof_scores).max() - (-lof_scores).min() + 1e-9)
        result = df.copy()
        result["anomaly_score"] = np.round(normed, 4)
        result["lof_score"] = np.round(lof_scores, 4)
        result["predicted_failure"] = (raw_preds == -1).astype(int)
        return result

    def evaluate(self, df: pd.DataFrame) -> Dict:
        preds = self.predict(df)
        y = df["is_failure"].values
        cm = confusion_matrix(y, preds)
        report = classification_report(y, preds, output_dict=True,
                                       target_names=["normal", "failure"])
        print("\n[LOF] Evaluation")
        print("Confusion Matrix:\n", cm)
        print(classification_report(y, preds, target_names=["normal", "failure"]))
        return {"confusion_matrix": cm, "report": report}

    def save(self, path: str = "outputs/lof_streetlight.pkl") -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"scaler": self.scaler, "model": self.model,
                     "feature_cols": self.feature_cols,
                     "n_neighbors": self.n_neighbors,
                     "contamination": self.contamination}, path)
        print(f"[LOF] Saved → {path}")

    @classmethod
    def load(cls, path: str) -> "LOFDetector":
        data = joblib.load(path)
        obj = cls(n_neighbors=data["n_neighbors"], contamination=data["contamination"])
        obj.scaler = data["scaler"]
        obj.model = data["model"]
        obj.feature_cols = data["feature_cols"]
        print(f"[LOF] Loaded ← {path}")
        return obj


# ------------------------------------------------------------------
# Quick self-test
# ------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from data.data_generator import generate_dataset, engineer_features, FEATURE_COLS

    df = generate_dataset(n_lights=200, days=14, anomaly_rate=0.08, seed=42)
    df = engineer_features(df)
    df_night = df[df["is_operational_hour"] == 1].copy()
    train_df, test_df = train_test_split(df_night, test_size=0.2, random_state=42,
                                         stratify=df_night["is_failure"])

    print("=" * 50)
    print("Z-Score Detector")
    print("=" * 50)
    zs = ZScoreDetector()
    zs.fit(train_df, FEATURE_COLS)
    zs.tune_threshold(test_df)
    zs.evaluate(test_df)
    zs.save("outputs/zscore_streetlight.pkl")

    print("\n" + "=" * 50)
    print("LOF Detector")
    print("=" * 50)
    lof = LOFDetector(n_neighbors=20, contamination=0.08)
    lof.fit(train_df, FEATURE_COLS)
    lof.evaluate(test_df)
    lof.save("outputs/lof_streetlight.pkl")