"""
lstm_autoencoder.py
--------------------
LSTM Autoencoder for streetlight brightness anomaly detection.
Learns normal temporal patterns; high reconstruction error = failure.

Best for: detecting sequential / temporal anomalies (gradual dimming,
          periodic flicker, slow voltage drift).

Requires: torch >= 2.0
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from pathlib import Path
from typing import Tuple, Dict, Optional
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix


# ------------------------------------------------------------------
# Model Architecture
# ------------------------------------------------------------------

class LSTMAutoencoder(nn.Module):
    """
    Sequence-to-sequence LSTM autoencoder.

    Encoder compresses the input sequence to a fixed latent vector.
    Decoder reconstructs the original sequence from the latent vector.
    High reconstruction error → anomalous reading pattern.
    """

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # Encoder
        self.encoder = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )

        # Bottleneck → latent representation
        self.bottleneck = nn.Linear(hidden_size, hidden_size // 2)
        self.expand = nn.Linear(hidden_size // 2, hidden_size)

        # Decoder
        self.decoder = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )

        self.output_layer = nn.Linear(hidden_size, input_size)
        self.relu = nn.ReLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x: (batch, seq_len, input_size)
        returns: (batch, seq_len, input_size)  — reconstruction
        """
        batch_size, seq_len, _ = x.shape

        # Encode
        _, (h_n, c_n) = self.encoder(x)
        latent = self.relu(self.bottleneck(h_n[-1]))          # (batch, hidden//2)
        latent_expanded = self.relu(self.expand(latent))      # (batch, hidden)

        # Repeat latent vector across time steps for decoder input
        decoder_input = latent_expanded.unsqueeze(1).repeat(1, seq_len, 1)

        # Decode
        decoded, _ = self.decoder(decoder_input)
        reconstruction = self.output_layer(decoded)           # (batch, seq_len, input_size)
        return reconstruction


# ------------------------------------------------------------------
# Training & Inference Wrapper
# ------------------------------------------------------------------

class StreetlightLSTMAE:
    """High-level wrapper: fit, predict, evaluate, save/load."""

    def __init__(
        self,
        seq_len: int = 24,           # 24 hours look-back window
        hidden_size: int = 64,
        num_layers: int = 2,
        lr: float = 1e-3,
        epochs: int = 30,
        batch_size: int = 128,
        dropout: float = 0.2,
        device: Optional[str] = None,
    ):
        self.seq_len = seq_len
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lr = lr
        self.epochs = epochs
        self.batch_size = batch_size
        self.dropout = dropout
        self.device = torch.device(
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.scaler = StandardScaler()
        self.model: Optional[LSTMAutoencoder] = None
        self.threshold: float = 0.0
        self.feature_cols = None
        self.train_losses = []
        print(f"[LSTM-AE] Device: {self.device}")

    # ------------------------------------------------------------------
    # Data helpers
    # ------------------------------------------------------------------

    def _build_sequences(self, X: np.ndarray) -> np.ndarray:
        """
        Slide a window of length seq_len over X.
        Returns shape (N - seq_len + 1, seq_len, features).
        """
        seqs = []
        for i in range(len(X) - self.seq_len + 1):
            seqs.append(X[i: i + self.seq_len])
        return np.array(seqs, dtype=np.float32)

    def _df_to_sequences(
        self,
        df: pd.DataFrame,
        feature_cols: list,
        scale: bool = False,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert a DataFrame (sorted by light_id, timestamp) into
        per-light sequences. Returns (sequences, labels).
        """
        all_seqs, all_labels = [], []

        for lid, group in df.groupby("light_id"):
            group = group.sort_values("timestamp")
            X = group[feature_cols].values.astype(np.float32)
            if scale:
                X = self.scaler.transform(X)
            y = group["is_failure"].values

            seqs = self._build_sequences(X)
            # Label for each sequence = label of last step
            labels = y[self.seq_len - 1:]
            all_seqs.append(seqs)
            all_labels.append(labels)

        return np.concatenate(all_seqs), np.concatenate(all_labels)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(
        self,
        df: pd.DataFrame,
        feature_cols: list,
        val_df: Optional[pd.DataFrame] = None,
    ) -> "StreetlightLSTMAE":
        self.feature_cols = feature_cols

        # Fit scaler on normal readings only
        normal_df = df[df["is_failure"] == 0]
        self.scaler.fit(normal_df[feature_cols].values)

        # Build sequences from normal data only
        train_seqs, _ = self._df_to_sequences(normal_df, feature_cols, scale=True)

        tensor = torch.tensor(train_seqs, dtype=torch.float32)
        loader = DataLoader(TensorDataset(tensor), batch_size=self.batch_size, shuffle=True)

        # Initialise model
        self.model = LSTMAutoencoder(
            input_size=len(feature_cols),
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            dropout=self.dropout,
        ).to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)
        criterion = nn.MSELoss()

        print(f"[LSTM-AE] Training {self.epochs} epochs on "
              f"{len(train_seqs):,} sequences (seq_len={self.seq_len}) ...")

        self.model.train()
        for epoch in range(1, self.epochs + 1):
            epoch_loss = 0.0
            for (batch,) in loader:
                batch = batch.to(self.device)
                optimizer.zero_grad()
                recon = self.model(batch)
                loss = criterion(recon, batch)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                epoch_loss += loss.item() * len(batch)

            avg_loss = epoch_loss / len(train_seqs)
            self.train_losses.append(avg_loss)
            scheduler.step()

            if epoch % 5 == 0 or epoch == 1:
                print(f"  Epoch {epoch:3d}/{self.epochs} | Loss: {avg_loss:.6f} "
                      f"| LR: {scheduler.get_last_lr()[0]:.6f}")

        print("[LSTM-AE] Training complete.")

        if val_df is not None:
            self.tune_threshold(val_df, feature_cols)

        return self

    # ------------------------------------------------------------------
    # Threshold tuning
    # ------------------------------------------------------------------

    def _reconstruction_errors(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Return (per-sequence MSE errors, labels)."""
        seqs, labels = self._df_to_sequences(df, self.feature_cols, scale=True)
        tensor = torch.tensor(seqs, dtype=torch.float32)
        loader = DataLoader(TensorDataset(tensor), batch_size=256, shuffle=False)

        self.model.eval()
        errors = []
        with torch.no_grad():
            for (batch,) in loader:
                batch = batch.to(self.device)
                recon = self.model(batch)
                mse = ((recon - batch) ** 2).mean(dim=(1, 2))
                errors.extend(mse.cpu().numpy())

        return np.array(errors), labels

    def tune_threshold(self, df_val: pd.DataFrame, feature_cols: list) -> float:
        from sklearn.metrics import f1_score

        errors, labels = self._reconstruction_errors(df_val)
        best_f1, best_t = 0.0, 0.0

        for pct in np.linspace(70, 99, 60):
            t = np.percentile(errors, pct)
            preds = (errors > t).astype(int)
            f1 = f1_score(labels, preds, zero_division=0)
            if f1 > best_f1:
                best_f1, best_t = f1, t

        self.threshold = best_t
        print(f"[LSTM-AE] Best threshold: {best_t:.6f} | F1: {best_f1:.4f}")
        return best_t

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        errors, _ = self._reconstruction_errors(df)
        return (errors > self.threshold).astype(int)

    def predict_with_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        errors, labels = self._reconstruction_errors(df)
        preds = (errors > self.threshold).astype(int)
        # Normalise errors to [0,1] for display
        normed = (errors - errors.min()) / (errors.max() - errors.min() + 1e-9)

        # Align back to original df (last row of each sequence window)
        result_rows = []
        for lid, group in df.groupby("light_id"):
            group = group.sort_values("timestamp").iloc[self.seq_len - 1:].copy()
            result_rows.append(group)

        result_df = pd.concat(result_rows)
        result_df = result_df.iloc[:len(errors)].copy()
        result_df["recon_error"] = np.round(errors, 6)
        result_df["anomaly_score"] = np.round(normed, 4)
        result_df["predicted_failure"] = preds
        return result_df

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def evaluate(self, df: pd.DataFrame) -> Dict:
        errors, labels = self._reconstruction_errors(df)
        preds = (errors > self.threshold).astype(int)
        cm = confusion_matrix(labels, preds)
        report = classification_report(labels, preds, output_dict=True,
                                       target_names=["normal", "failure"])
        print("\n[LSTM-AE] Evaluation")
        print("Confusion Matrix:\n", cm)
        print(classification_report(labels, preds, target_names=["normal", "failure"]))
        return {"confusion_matrix": cm, "report": report}

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str = "outputs/lstm_ae_streetlight.pt") -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        torch.save({
            "model_state": self.model.state_dict(),
            "scaler": self.scaler,
            "threshold": self.threshold,
            "feature_cols": self.feature_cols,
            "config": {
                "input_size": len(self.feature_cols),
                "hidden_size": self.hidden_size,
                "num_layers": self.num_layers,
                "seq_len": self.seq_len,
                "dropout": self.dropout,
            },
        }, path)
        print(f"[LSTM-AE] Saved → {path}")

    @classmethod
    def load(cls, path: str) -> "StreetlightLSTMAE":
        data = torch.load(path, map_location="cpu")
        cfg = data["config"]
        obj = cls(
            seq_len=cfg["seq_len"],
            hidden_size=cfg["hidden_size"],
            num_layers=cfg["num_layers"],
            dropout=cfg["dropout"],
        )
        obj.model = LSTMAutoencoder(
            input_size=cfg["input_size"],
            hidden_size=cfg["hidden_size"],
            num_layers=cfg["num_layers"],
            dropout=cfg["dropout"],
        )
        obj.model.load_state_dict(data["model_state"])
        obj.model.eval()
        obj.scaler = data["scaler"]
        obj.threshold = data["threshold"]
        obj.feature_cols = data["feature_cols"]
        print(f"[LSTM-AE] Loaded ← {path}")
        return obj


# ------------------------------------------------------------------
# Quick self-test
# ------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from data.data_generator import generate_dataset, engineer_features, FEATURE_COLS

    print("=== LSTM Autoencoder — Streetlight Failure Detection ===\n")

    df = generate_dataset(n_lights=100, days=30, anomaly_rate=0.08, seed=42)
    df = engineer_features(df)

    df_night = df[df["is_operational_hour"] == 1].copy()
    train_df, test_df = train_test_split(df_night, test_size=0.2, random_state=42,
                                         stratify=df_night["is_failure"])

    model = StreetlightLSTMAE(seq_len=6, hidden_size=32, num_layers=2, epochs=10, batch_size=64)
    model.fit(train_df, FEATURE_COLS, val_df=test_df)
    model.evaluate(test_df)
    model.save("outputs/lstm_ae_streetlight.pt")