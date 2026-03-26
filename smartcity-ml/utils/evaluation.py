"""
evaluation.py
-------------
Evaluation utilities for the streetlight failure detection system.
Covers: metrics, confusion matrix plots, ROC/PR curves, feature importance,
        model comparison, and alert report generation.
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_curve, auc,
    precision_recall_curve,
    average_precision_score,
    f1_score,
)


PALETTE = {
    "blue":   "#185FA5",
    "red":    "#E24B4A",
    "green":  "#3B6D11",
    "amber":  "#BA7517",
    "gray":   "#5F5E5A",
    "light":  "#F1EFE8",
}


def _fig_style():
    plt.rcParams.update({
        "figure.facecolor": "white",
        "axes.facecolor": "#FAFAF8",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": "#E8E6E0",
        "grid.linewidth": 0.5,
        "font.family": "DejaVu Sans",
        "font.size": 11,
    })


# ------------------------------------------------------------------
# Core metric helper
# ------------------------------------------------------------------

def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray,
                    y_score: Optional[np.ndarray] = None) -> Dict:
    """Return a dictionary of evaluation metrics."""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    precision = tp / (tp + fp + 1e-9)
    recall    = tp / (tp + fn + 1e-9)
    f1        = 2 * precision * recall / (precision + recall + 1e-9)
    accuracy  = (tp + tn) / (tp + tn + fp + fn)
    fpr_rate  = fp / (fp + tn + 1e-9)

    metrics = {
        "accuracy":  round(accuracy, 4),
        "precision": round(precision, 4),
        "recall":    round(recall, 4),
        "f1":        round(f1, 4),
        "fpr":       round(fpr_rate, 4),
        "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn),
    }

    if y_score is not None:
        fpr, tpr, _ = roc_curve(y_true, y_score)
        metrics["roc_auc"] = round(auc(fpr, tpr), 4)
        metrics["avg_precision"] = round(average_precision_score(y_true, y_score), 4)

    return metrics


# ------------------------------------------------------------------
# Confusion matrix plot
# ------------------------------------------------------------------

def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    model_name: str = "Model",
    save_path: Optional[str] = None,
) -> plt.Figure:
    _fig_style()
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4))

    im = ax.imshow(cm, cmap="Blues", aspect="auto")
    labels = ["Normal", "Failure"]
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(labels); ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title(f"Confusion Matrix — {model_name}", pad=12)

    cell_labels = [["TN", "FP"], ["FN", "TP"]]
    for i in range(2):
        for j in range(2):
            color = "white" if cm[i, j] > cm.max() * 0.5 else "black"
            ax.text(j, i, f"{cell_labels[i][j]}\n{cm[i, j]}",
                    ha="center", va="center", color=color, fontsize=13, fontweight="bold")

    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    plt.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] Confusion matrix saved → {save_path}")
    return fig


# ------------------------------------------------------------------
# ROC + PR curve
# ------------------------------------------------------------------

def plot_roc_pr(
    results: Dict[str, Dict],
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    results: { model_name: {"y_true": arr, "y_score": arr} }
    """
    _fig_style()
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    colors = [PALETTE["blue"], PALETTE["red"], PALETTE["green"], PALETTE["amber"]]

    for idx, (name, data) in enumerate(results.items()):
        color = colors[idx % len(colors)]
        y_true, y_score = data["y_true"], data["y_score"]

        # ROC
        fpr, tpr, _ = roc_curve(y_true, y_score)
        roc_auc = auc(fpr, tpr)
        axes[0].plot(fpr, tpr, color=color, lw=1.8, label=f"{name} (AUC={roc_auc:.3f})")

        # PR
        prec, rec, _ = precision_recall_curve(y_true, y_score)
        ap = average_precision_score(y_true, y_score)
        axes[1].plot(rec, prec, color=color, lw=1.8, label=f"{name} (AP={ap:.3f})")

    axes[0].plot([0, 1], [0, 1], "k--", lw=0.8, alpha=0.4)
    axes[0].set_xlabel("False Positive Rate"); axes[0].set_ylabel("True Positive Rate")
    axes[0].set_title("ROC Curve"); axes[0].legend(fontsize=9)

    axes[1].set_xlabel("Recall"); axes[1].set_ylabel("Precision")
    axes[1].set_title("Precision-Recall Curve"); axes[1].legend(fontsize=9)

    plt.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] ROC/PR curves saved → {save_path}")
    return fig


# ------------------------------------------------------------------
# Brightness time series with anomaly overlay
# ------------------------------------------------------------------

def plot_brightness_series(
    df: pd.DataFrame,
    light_id: str,
    predictions_col: str = "predicted_failure",
    save_path: Optional[str] = None,
) -> plt.Figure:
    _fig_style()
    sub = df[df["light_id"] == light_id].sort_values("timestamp")

    fig, ax = plt.subplots(figsize=(13, 4))
    ax.plot(sub["timestamp"], sub["brightness_lux"],
            color=PALETTE["blue"], lw=1.2, label="Brightness (lux)", zorder=2)

    # Ground truth failures
    fail_true = sub[sub["is_failure"] == 1]
    ax.scatter(fail_true["timestamp"], fail_true["brightness_lux"],
               color=PALETTE["red"], s=40, zorder=4, label="True failure", marker="x")

    if predictions_col in sub.columns:
        fail_pred = sub[(sub[predictions_col] == 1) & (sub["is_failure"] == 0)]
        ax.scatter(fail_pred["timestamp"], fail_pred["brightness_lux"],
                   color=PALETTE["amber"], s=30, zorder=3, label="False positive", marker="^")

    ax.axhline(280, color=PALETTE["gray"], lw=0.8, ls="--", label="Min threshold (280 lux)")
    ax.set_xlabel("Timestamp"); ax.set_ylabel("Brightness (lux)")
    ax.set_title(f"Brightness Series — {light_id}", pad=10)
    ax.legend(fontsize=9)
    plt.tight_layout()

    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] Brightness series saved → {save_path}")
    return fig


# ------------------------------------------------------------------
# Feature importance (permutation-based approximation)
# ------------------------------------------------------------------

def permutation_importance(
    model,
    df: pd.DataFrame,
    feature_cols: List[str],
    n_repeats: int = 10,
    metric_fn=f1_score,
) -> pd.DataFrame:
    """
    Model-agnostic permutation importance.
    Works with any model that exposes .predict(df).
    """
    baseline = metric_fn(df["is_failure"].values,
                         model.predict(df), zero_division=0)
    importances = {}

    for feat in feature_cols:
        scores = []
        for _ in range(n_repeats):
            df_perm = df.copy()
            df_perm[feat] = np.random.permutation(df_perm[feat].values)
            score = metric_fn(df_perm["is_failure"].values,
                              model.predict(df_perm), zero_division=0)
            scores.append(baseline - score)   # positive = feature was helpful
        importances[feat] = np.mean(scores)

    result = (pd.DataFrame.from_dict(importances, orient="index", columns=["importance"])
              .sort_values("importance", ascending=False))
    return result


def plot_feature_importance(
    importances: pd.DataFrame,
    title: str = "Feature Importance (Permutation)",
    save_path: Optional[str] = None,
) -> plt.Figure:
    _fig_style()
    top = importances.head(10)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    colors = [PALETTE["blue"] if v >= 0 else PALETTE["red"]
              for v in top["importance"]]
    ax.barh(top.index[::-1], top["importance"].values[::-1], color=colors[::-1], height=0.6)
    ax.axvline(0, color=PALETTE["gray"], lw=0.8)
    ax.set_xlabel("Mean F1 drop when permuted")
    ax.set_title(title, pad=10)
    plt.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] Feature importance saved → {save_path}")
    return fig


# ------------------------------------------------------------------
# Model comparison table + bar chart
# ------------------------------------------------------------------

def compare_models(
    model_metrics: Dict[str, Dict],
    save_path: Optional[str] = None,
) -> Tuple[pd.DataFrame, plt.Figure]:
    """
    model_metrics: { model_name: compute_metrics(...) }
    """
    rows = []
    for name, m in model_metrics.items():
        rows.append({
            "Model": name,
            "Accuracy":  f"{m['accuracy']*100:.1f}%",
            "Precision": f"{m['precision']*100:.1f}%",
            "Recall":    f"{m['recall']*100:.1f}%",
            "F1":        f"{m['f1']*100:.1f}%",
            "ROC AUC":   f"{m.get('roc_auc', 0)*100:.1f}%" if "roc_auc" in m else "—",
        })
    df_cmp = pd.DataFrame(rows)
    print("\n[Eval] Model Comparison:")
    print(df_cmp.to_string(index=False))

    # Bar chart
    _fig_style()
    metrics_to_plot = ["accuracy", "precision", "recall", "f1"]
    x = np.arange(len(model_metrics))
    width = 0.2
    colors = [PALETTE["blue"], PALETTE["green"], PALETTE["amber"], PALETTE["red"]]
    fig, ax = plt.subplots(figsize=(10, 4.5))

    for i, met in enumerate(metrics_to_plot):
        vals = [model_metrics[n][met] * 100 for n in model_metrics]
        bars = ax.bar(x + i * width, vals, width, label=met.capitalize(), color=colors[i], alpha=0.85)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                    f"{v:.1f}", ha="center", va="bottom", fontsize=8)

    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(list(model_metrics.keys()), fontsize=10)
    ax.set_ylabel("Score (%)")
    ax.set_ylim(0, 110)
    ax.set_title("Model Comparison", pad=10)
    ax.legend(fontsize=9)
    plt.tight_layout()

    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] Model comparison chart saved → {save_path}")

    return df_cmp, fig


# ------------------------------------------------------------------
# Alert report generator
# ------------------------------------------------------------------

def generate_alert_report(
    df_predictions: pd.DataFrame,
    prediction_col: str = "predicted_failure",
    score_col: str = "anomaly_score",
    top_n: int = 20,
    save_path: Optional[str] = None,
) -> pd.DataFrame:
    """
    Generate a ranked alert report from model predictions.
    Outputs a CSV-ready DataFrame of the most critical predicted failures.
    """
    alerts = df_predictions[df_predictions[prediction_col] == 1].copy()
    if score_col in alerts.columns:
        alerts = alerts.sort_values(score_col, ascending=False)

    cols = ["light_id", "timestamp", "brightness_lux", score_col,
            "failure_type", "is_failure"]
    cols = [c for c in cols if c in alerts.columns]
    report = alerts[cols].head(top_n).reset_index(drop=True)
    report.index += 1  # 1-indexed rank

    print(f"\n[Eval] Top {top_n} predicted failures:")
    print(report.to_string())

    if save_path:
        report.to_csv(save_path, index_label="rank")
        print(f"[Eval] Alert report saved → {save_path}")

    return report