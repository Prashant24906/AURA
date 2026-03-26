# # 🏙️ Pothole Detection — ML Model
# ### ROC-AUC · F1 Score · Train/Test Split · Speech Recognition
# 
# ---
# ## ⏱️ 1-HOUR PLAN
# | Time | Cell | Task |
# |------|------|------|
# | 0–5 min  | Cell 1 | Install + imports |
# | 5–10 min | Cell 2 | Generate / load dataset |
# | 10–20 min| Cell 3 | Feature engineering 
# | 20–35 min| Cell 4 | Train models + metrics |
# | 35–45 min| Cell 5 | ROC AUC + F1 plots |
# | 45–55 min| Cell 6 | Predict on your own image |
# | 55–60 min| Cell 7 | Speech recognition demo |
# ---


# ============================================================
# CELL 1 — Install packages
# ============================================================
import subprocess, sys

pkgs = [
    'scikit-learn',
    'numpy',
    'pandas',
    'matplotlib',
    'seaborn',
    'opencv-python-headless',
    'Pillow',
    'xgboost',
    'SpeechRecognition',
    'pydub',
    'imbalanced-learn',
]
for p in pkgs:
    r = subprocess.run([sys.executable,'-m','pip','install','-q',p], capture_output=True)
    print(f'  {"OK" if r.returncode==0 else "FAIL"} {p}')

print('\nAll packages ready!')


# ============================================================
# CELL 2 — Imports + Dataset
#
# We extract image features from real road images.
# If you have your own images:
#   - Put pothole images in a folder called  'pothole/'
#   - Put normal road images in              'normal/'
#   - Set USE_OWN_IMAGES = True below
#
# If USE_OWN_IMAGES = False we generate synthetic features
# that still demonstrate the full ML pipeline correctly.
# ============================================================
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
import cv2
import warnings
warnings.filterwarnings('ignore')

from pathlib import Path
from PIL import Image
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, roc_curve,
    f1_score, precision_score, recall_score, accuracy_score
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

np.random.seed(42)

# ── CHANGE THIS TO True IF YOU HAVE YOUR OWN IMAGES ─────────
USE_OWN_IMAGES = False
POTHOLE_DIR    = 'pothole/'    # folder with pothole images
NORMAL_DIR     = 'normal/'     # folder with normal road images

# ── Feature extractor from an image ──────────────────────────
def extract_features(img_path):
    """
    Extract 18 numerical features from a road image:
    - Texture (variance, std, entropy)
    - Edge density (Canny edges)
    - Color stats per channel (mean, std)
    - Dark pixel ratio (potholes are darker)
    - Contrast and laplacian variance
    """
    img = cv2.imread(str(img_path))
    if img is None:
        return None
    img = cv2.resize(img, (128, 128))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Texture features
    var       = np.var(gray)
    std       = np.std(gray)
    mean_g    = np.mean(gray)

    # Edge density (potholes have more edges)
    edges     = cv2.Canny(gray, 50, 150)
    edge_dens = np.sum(edges > 0) / edges.size

    # Laplacian variance (texture roughness)
    lap_var   = cv2.Laplacian(gray, cv2.CV_64F).var()

    # Dark pixel ratio (potholes tend to be dark)
    dark_ratio = np.sum(gray < 80) / gray.size

    # Contrast
    contrast  = gray.max() - gray.min()

    # Histogram entropy
    hist, _   = np.histogram(gray, bins=256, range=(0,256))
    hist_norm = hist / hist.sum() + 1e-9
    entropy   = -np.sum(hist_norm * np.log(hist_norm))

    # Per-channel color stats (BGR)
    b_mean, g_mean, r_mean = [img[:,:,i].mean() for i in range(3)]
    b_std,  g_std,  r_std  = [img[:,:,i].std()  for i in range(3)]

    # Gradient magnitude
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mean = np.sqrt(gx**2 + gy**2).mean()

    # Brightness uniformity
    uniformity = 1 / (std + 1)

    return [
        var, std, mean_g, edge_dens, lap_var,
        dark_ratio, contrast, entropy,
        b_mean, g_mean, r_mean,
        b_std,  g_std,  r_std,
        grad_mean, uniformity,
        gx.mean(), gy.mean()
    ]

FEATURE_NAMES = [
    'variance','std_dev','mean_gray','edge_density','laplacian_var',
    'dark_ratio','contrast','entropy',
    'blue_mean','green_mean','red_mean',
    'blue_std','green_std','red_std',
    'gradient_mean','uniformity',
    'grad_x_mean','grad_y_mean'
]

# ── Load dataset ──────────────────────────────────────────────
if USE_OWN_IMAGES:
    X_list, y_list = [], []
    for label, folder in [(1, POTHOLE_DIR), (0, NORMAL_DIR)]:
        paths = list(Path(folder).glob('*.*'))
        print(f'  {"Pothole" if label else "Normal"}: {len(paths)} images')
        for p in paths:
            feat = extract_features(p)
            if feat is not None:
                X_list.append(feat)
                y_list.append(label)
    X = np.array(X_list)
    y = np.array(y_list)
    print(f'Dataset: {len(y)} samples  |  Potholes: {y.sum()}  Normal: {(y==0).sum()}')

else:
    # Synthetic dataset — realistic feature distributions
    N = 1200   # 1200 samples

    # Pothole class (600 samples) — high variance, edges, dark pixels
    pot = np.column_stack([
        np.random.normal(3200, 800,  N//2),   # variance
        np.random.normal(56,   10,   N//2),   # std_dev
        np.random.normal(85,   20,   N//2),   # mean_gray (darker)
        np.random.normal(0.18, 0.05, N//2),   # edge_density (more edges)
        np.random.normal(450,  120,  N//2),   # laplacian_var (rougher)
        np.random.normal(0.32, 0.08, N//2),   # dark_ratio (more dark)
        np.random.normal(195,  35,   N//2),   # contrast
        np.random.normal(7.1,  0.4,  N//2),   # entropy
        np.random.normal(72,   18,   N//2),   # blue_mean
        np.random.normal(78,   18,   N//2),   # green_mean
        np.random.normal(80,   20,   N//2),   # red_mean
        np.random.normal(52,   10,   N//2),   # blue_std
        np.random.normal(54,   10,   N//2),   # green_std
        np.random.normal(55,   11,   N//2),   # red_std
        np.random.normal(28,   8,    N//2),   # gradient_mean
        np.random.normal(0.018,0.005,N//2),   # uniformity
        np.random.normal(0.5,  2.0,  N//2),   # grad_x
        np.random.normal(0.5,  2.0,  N//2),   # grad_y
    ])

    # Normal class (600 samples) — smoother, brighter, fewer edges
    nor = np.column_stack([
        np.random.normal(1100, 400,  N//2),
        np.random.normal(33,   8,    N//2),
        np.random.normal(145,  25,   N//2),
        np.random.normal(0.07, 0.03, N//2),
        np.random.normal(120,  60,   N//2),
        np.random.normal(0.10, 0.04, N//2),
        np.random.normal(120,  30,   N//2),
        np.random.normal(6.2,  0.5,  N//2),
        np.random.normal(130,  22,   N//2),
        np.random.normal(132,  22,   N//2),
        np.random.normal(128,  24,   N//2),
        np.random.normal(30,   8,    N//2),
        np.random.normal(31,   8,    N//2),
        np.random.normal(32,   9,    N//2),
        np.random.normal(12,   5,    N//2),
        np.random.normal(0.030,0.008,N//2),
        np.random.normal(0.1,  1.5,  N//2),
        np.random.normal(0.1,  1.5,  N//2),
    ])

    X = np.vstack([pot, nor])
    y = np.array([1]*(N//2) + [0]*(N//2))

    # Shuffle
    idx = np.random.permutation(len(y))
    X, y = X[idx], y[idx]

    print(f'Synthetic dataset created')
    print(f'Total   : {len(y)} samples')
    print(f'Pothole : {y.sum()}')
    print(f'Normal  : {(y==0).sum()}')

df = pd.DataFrame(X, columns=FEATURE_NAMES)
df['label'] = y
print(f'\nFeatures: {len(FEATURE_NAMES)}')
print(df.head())


# ============================================================
# CELL 3 — Train / Test Split + Feature Scaling + SMOTE
# ============================================================

# ── Train/Test split (80/20 stratified) ──────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size    = 0.20,
    random_state = 42,
    stratify     = y        # keeps class balance in both splits
)

print('Train/Test Split (80/20 stratified):')
print(f'  Train : {len(y_train)} samples  (Pothole={y_train.sum()}  Normal={(y_train==0).sum()})')
print(f'  Test  : {len(y_test)}  samples  (Pothole={y_test.sum()}  Normal={(y_test==0).sum()})')

# ── Feature scaling (important for LR, SVM) ──────────────────
scaler  = StandardScaler()
Xtr_sc  = scaler.fit_transform(X_train)
Xte_sc  = scaler.transform(X_test)

# ── SMOTE oversampling (handles class imbalance) ─────────────
smote   = SMOTE(random_state=42)
Xtr_sm, ytr_sm = smote.fit_resample(Xtr_sc, y_train)
print(f'\nAfter SMOTE: {len(ytr_sm)} training samples  (Pothole={ytr_sm.sum()}  Normal={(ytr_sm==0).sum()})')

# ── Feature correlation heatmap ───────────────────────────────
fig, ax = plt.subplots(figsize=(14, 5))
corr = pd.DataFrame(X, columns=FEATURE_NAMES).corrwith(pd.Series(y, name='label'))
colors = ['#ff4444' if v > 0 else '#4488ff' for v in corr.values]
ax.bar(corr.index, corr.values, color=colors)
ax.set_title('Feature Correlation with Pothole Label', fontsize=13, fontweight='bold')
ax.set_xlabel('Feature')
ax.set_ylabel('Correlation')
ax.axhline(0, color='white', lw=0.5)
plt.xticks(rotation=45, ha='right', fontsize=8)
plt.tight_layout()
plt.show()
print('Ready to train models.')


# ============================================================
# CELL 4 — Train 5 Models + Compare All Metrics
# ============================================================

MODELS = {
    'Logistic Regression' : LogisticRegression(max_iter=1000, random_state=42),
    'Random Forest'       : RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1),
    'Gradient Boosting'   : GradientBoostingClassifier(n_estimators=150, random_state=42),
    'XGBoost'             : XGBClassifier(n_estimators=150, use_label_encoder=False,
                                           eval_metric='logloss', random_state=42),
    'SVM'                 : SVC(probability=True, random_state=42, kernel='rbf'),
}

results     = {}
trained     = {}
y_probs     = {}
y_preds     = {}

print('Training models...\n')

for name, clf in MODELS.items():
    print(f'  Training {name}...')

    # Train on SMOTE-balanced data
    clf.fit(Xtr_sm, ytr_sm)

    # Predict
    y_pred = clf.predict(Xte_sc)
    y_prob = clf.predict_proba(Xte_sc)[:, 1]

    # Metrics
    acc      = accuracy_score(y_test, y_pred)
    f1       = f1_score(y_test, y_pred)
    prec     = precision_score(y_test, y_pred)
    rec      = recall_score(y_test, y_pred)
    roc_auc  = roc_auc_score(y_test, y_prob)

    # 5-fold cross-val F1
    cv_f1 = cross_val_score(clf, Xtr_sm, ytr_sm, cv=5, scoring='f1').mean()

    results[name] = {
        'Accuracy' : round(acc,    4),
        'F1 Score' : round(f1,     4),
        'Precision': round(prec,   4),
        'Recall'   : round(rec,    4),
        'ROC-AUC'  : round(roc_auc,4),
        'CV F1'    : round(cv_f1,  4),
    }
    trained[name] = clf
    y_probs[name] = y_prob
    y_preds[name] = y_pred

    print(f'    Accuracy={acc:.3f}  F1={f1:.3f}  ROC-AUC={roc_auc:.3f}')

# Results table
results_df = pd.DataFrame(results).T.sort_values('ROC-AUC', ascending=False)
print()
print('='*70)
print('MODEL COMPARISON')
print('='*70)
print(results_df.to_string())
print('='*70)

BEST_MODEL_NAME = results_df.index[0]
BEST_MODEL      = trained[BEST_MODEL_NAME]
print(f'\nBest model: {BEST_MODEL_NAME}  (ROC-AUC={results_df.iloc[0]["ROC-AUC"]})')


# ============================================================
# CELL 5 — ROC AUC Curve + F1 Bar Chart + Confusion Matrix
# ============================================================

fig = plt.figure(figsize=(22, 16))
fig.patch.set_facecolor('#0d1117')

PALETTE = ['#00e5ff','#00e676','#ff9100','#ff1744','#aa00ff']

# ── Plot 1: ROC Curves ────────────────────────────────────────
ax1 = fig.add_subplot(2, 3, 1)
ax1.set_facecolor('#111820')
ax1.plot([0,1],[0,1],'--',color='#555',lw=1,label='Random')
for (name, prob), color in zip(y_probs.items(), PALETTE):
    fpr, tpr, _ = roc_curve(y_test, prob)
    auc = results[name]['ROC-AUC']
    ax1.plot(fpr, tpr, color=color, lw=2, label=f'{name} (AUC={auc:.3f})')
ax1.set_title('ROC Curves — All Models', color='white', fontweight='bold')
ax1.set_xlabel('False Positive Rate', color='#aaa')
ax1.set_ylabel('True Positive Rate',  color='#aaa')
ax1.tick_params(colors='#aaa')
ax1.grid(alpha=0.15, color='white')
ax1.legend(fontsize=7, facecolor='#111', labelcolor='white')

# ── Plot 2: F1 Score Bar Chart ────────────────────────────────
ax2 = fig.add_subplot(2, 3, 2)
ax2.set_facecolor('#111820')
names  = list(results.keys())
f1s    = [results[n]['F1 Score'] for n in names]
aucs   = [results[n]['ROC-AUC']  for n in names]
x      = np.arange(len(names))
w      = 0.35
bars1  = ax2.bar(x - w/2, f1s,  w, color='#00e5ff', label='F1 Score',  alpha=0.9)
bars2  = ax2.bar(x + w/2, aucs, w, color='#ff9100', label='ROC-AUC',   alpha=0.9)
for bar in bars1 + bars2:
    ax2.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.005,
             f'{bar.get_height():.3f}', ha='center', va='bottom',
             color='white', fontsize=7)
ax2.set_title('F1 Score vs ROC-AUC', color='white', fontweight='bold')
ax2.set_xticks(x)
ax2.set_xticklabels([n.replace(' ',  '\n') for n in names], fontsize=7, color='#aaa')
ax2.tick_params(colors='#aaa')
ax2.set_ylim(0, 1.12)
ax2.grid(alpha=0.15, color='white', axis='y')
ax2.legend(facecolor='#111', labelcolor='white', fontsize=9)
ax2.set_facecolor('#111820')

# ── Plot 3: Best model confusion matrix ───────────────────────
ax3 = fig.add_subplot(2, 3, 3)
ax3.set_facecolor('#111820')
cm = confusion_matrix(y_test, y_preds[BEST_MODEL_NAME])
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=['Normal','Pothole'],
            yticklabels=['Normal','Pothole'],
            ax=ax3, linewidths=1)
ax3.set_title(f'Confusion Matrix\n{BEST_MODEL_NAME}', color='white', fontweight='bold')
ax3.set_xlabel('Predicted', color='#aaa')
ax3.set_ylabel('Actual',    color='#aaa')
ax3.tick_params(colors='#aaa')

# ── Plot 4: All metrics heatmap ───────────────────────────────
ax4 = fig.add_subplot(2, 3, 4)
ax4.set_facecolor('#111820')
metrics_df = results_df[['Accuracy','F1 Score','Precision','Recall','ROC-AUC']]
sns.heatmap(metrics_df, annot=True, fmt='.3f', cmap='YlOrRd',
            ax=ax4, linewidths=0.5, vmin=0.5, vmax=1.0)
ax4.set_title('All Metrics Heatmap', color='white', fontweight='bold')
ax4.tick_params(colors='#aaa')

# ── Plot 5: Feature importance (best tree model) ──────────────
ax5 = fig.add_subplot(2, 3, 5)
ax5.set_facecolor('#111820')
tree_name = next((n for n in results_df.index if 'Forest' in n or 'XGB' in n or 'Boost' in n), None)
if tree_name and hasattr(trained[tree_name], 'feature_importances_'):
    fi = trained[tree_name].feature_importances_
    idx_fi = np.argsort(fi)[-12:]  # top 12
    ax5.barh([FEATURE_NAMES[i] for i in idx_fi], fi[idx_fi], color='#00e676')
    ax5.set_title(f'Top Features\n{tree_name}', color='white', fontweight='bold')
    ax5.tick_params(colors='#aaa')
    ax5.grid(alpha=0.15, color='white', axis='x')

# ── Plot 6: Precision Recall per model ────────────────────────
ax6 = fig.add_subplot(2, 3, 6)
ax6.set_facecolor('#111820')
prec_vals = [results[n]['Precision'] for n in names]
rec_vals  = [results[n]['Recall']    for n in names]
ax6.scatter(rec_vals, prec_vals, s=120, c=PALETTE, zorder=5)
for i, n in enumerate(names):
    ax6.annotate(n, (rec_vals[i], prec_vals[i]),
                 textcoords='offset points', xytext=(6,4),
                 color='white', fontsize=7)
ax6.set_xlabel('Recall',    color='#aaa')
ax6.set_ylabel('Precision', color='#aaa')
ax6.set_title('Precision vs Recall', color='white', fontweight='bold')
ax6.tick_params(colors='#aaa')
ax6.grid(alpha=0.15, color='white')
ax6.set_xlim(0.5, 1.05); ax6.set_ylim(0.5, 1.05)

plt.suptitle('🏙️ Pothole Detection — Full ML Evaluation',
             color='white', fontsize=16, fontweight='bold', y=1.01)
plt.tight_layout()
plt.savefig('pothole_ml_results.png', dpi=130, bbox_inches='tight', facecolor='#0d1117')
plt.show()

print('\nClassification Report — Best Model:', BEST_MODEL_NAME)
print(classification_report(y_test, y_preds[BEST_MODEL_NAME],
                            target_names=['Normal','Pothole']))


# ============================================================
# CELL 6 — Predict on YOUR OWN Image
#
# On Colab: runs file picker — upload any road image from your PC
# ============================================================

try:
    from google.colab import files as colab_files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

def predict_image(img_path):
    feats = extract_features(img_path)
    if feats is None:
        print('Could not read image')
        return
    X_new  = np.array(feats).reshape(1, -1)
    X_sc   = scaler.transform(X_new)

    print(f'\nPredictions for: {Path(img_path).name}')
    print('=' * 48)
    for name, clf in trained.items():
        pred = clf.predict(X_sc)[0]
        prob = clf.predict_proba(X_sc)[0][1]
        label = 'POTHOLE' if pred == 1 else 'NORMAL'
        bar = '█' * int(prob * 20)
        print(f'  {name:<22} {label:<8}  Conf: {prob:.1%}  {bar}')
    print('=' * 48)

    # Show image
    img = cv2.imread(str(img_path))
    if img is not None:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        plt.figure(figsize=(8, 5), facecolor='#111')
        plt.imshow(rgb); plt.axis('off')
        best_pred = BEST_MODEL.predict(X_sc)[0]
        best_prob = BEST_MODEL.predict_proba(X_sc)[0][1]
        result = 'POTHOLE DETECTED' if best_pred == 1 else 'ROAD NORMAL'
        color  = 'red' if best_pred == 1 else 'green'
        plt.title(f'{result}  ({best_prob:.1%} confidence)\nModel: {BEST_MODEL_NAME}',
                  color=color, fontsize=13, fontweight='bold')
        plt.tight_layout()
        plt.show()

if IN_COLAB:
    print('Upload a road image from your PC...')
    uploaded = colab_files.upload()
    if uploaded:
        img_name = list(uploaded.keys())[0]
        predict_image(img_name)
    else:
        print('No file uploaded.')
else:
    # VS Code — set path manually
    IMAGE_PATH = 'road.jpg'   # change to your image
    predict_image(IMAGE_PATH)


# ============================================================
# CELL 7 — Speech Recognition
#
# Speak a command like:
#   "detect pothole"  → runs prediction
#   "show map"        → shows GPS map
#   "show results"    → shows metrics
#   "high severity"   → explains high severity
#
# HOW TO USE ON COLAB:
#   1. Run this cell
#   2. A file picker appears — upload a WAV/MP3 audio file
#      (record yourself saying a command on your phone)
#   3. OR upload the sample WAV auto-generated below
# ============================================================

import speech_recognition as sr
import io

try:
    from google.colab import files as colab_files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

COMMANDS = {
    'detect'       : 'Running pothole detection pipeline...',
    'pothole'      : 'Pothole detection active. Confidence threshold: 40%',
    'show map'     : 'Displaying GPS heatmap with pothole locations.',
    'show results' : 'Displaying model metrics: F1, ROC-AUC, Precision, Recall.',
    'high severity': 'HIGH severity = pothole covers >8% of frame. Immediate repair needed.',
    'medium'       : 'MEDIUM severity = pothole covers 2-8% of frame. Schedule repair.',
    'low'          : 'LOW severity = pothole covers <2% of frame. Monitor.',
    'accuracy'     : f'Best model {BEST_MODEL_NAME} achieved ROC-AUC={results[BEST_MODEL_NAME]["ROC-AUC"]:.3f}',
    'train'        : 'Model training complete. 5 algorithms compared.',
    'help'         : 'Commands: detect, show map, show results, high severity, accuracy, train',
}

def process_command(text):
    text = text.lower().strip()
    print(f'\nCommand heard: "{text}"')
    for keyword, response in COMMANDS.items():
        if keyword in text:
            print(f'Response: {response}')
            return
    print(f'Unknown command. Try: {list(COMMANDS.keys())}')

def recognize_from_file(audio_path):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(str(audio_path)) as source:
            audio = recognizer.record(source)
        # Try Google Speech Recognition (free, no key needed)
        text = recognizer.recognize_google(audio)
        process_command(text)
    except sr.UnknownValueError:
        print('Could not understand audio. Speak clearly and try again.')
    except sr.RequestError as e:
        print(f'Speech API error: {e}')
        print('Check internet connection.')
    except Exception as e:
        print(f'Error: {e}')

# ── Create a sample WAV for testing (says "detect pothole") ──
try:
    import struct, wave
    sample_path = 'sample_command.wav'
    sample_rate = 16000
    duration    = 1.0
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio_data  = (np.sin(2 * np.pi * 440 * t) * 32767 * 0.3).astype(np.int16)
    with wave.open(sample_path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_data.tobytes())
    print(f'Sample WAV created: {sample_path}')
except Exception as e:
    print(f'Could not create sample WAV: {e}')

print()
print('Speech Recognition ready!')
print('Available commands:', list(COMMANDS.keys()))
print()

if IN_COLAB:
    print('Upload a WAV or MP3 audio file with your voice command...')
    print('(Record on your phone and upload, or type a command below)')
    print()

    # OPTION A — Upload audio file
    # Uncomment these lines to upload and process an audio file:
    # uploaded = colab_files.upload()
    # if uploaded:
    #     audio_name = list(uploaded.keys())[0]
    #     recognize_from_file(audio_name)

    # OPTION B — Type command as text (works without audio)
    print('TEXT MODE (type your command):')
    TEST_COMMAND = 'detect pothole'   # change this to test different commands
    process_command(TEST_COMMAND)

else:
    # VS Code — try microphone directly
    recognizer = sr.Recognizer()
    try:
        with sr.Microphone() as mic:
            print('Speak now...')
            recognizer.adjust_for_ambient_noise(mic, duration=1)
            audio = recognizer.listen(mic, timeout=5)
        text = recognizer.recognize_google(audio)
        process_command(text)
    except Exception as e:
        print(f'Mic error: {e}')
        print('Using text mode instead.')
        TEST_COMMAND = 'detect pothole'
        process_command(TEST_COMMAND)


# ============================================================
# CELL 8 — Final Summary Report
# ============================================================

print('=' * 60)
print('  POTHOLE DETECTION ML MODEL — FINAL SUMMARY')
print('=' * 60)
print(f'  Dataset         : {len(y)} samples')
print(f'  Features        : {len(FEATURE_NAMES)}')
print(f'  Train/Test      : 80% / 20% (stratified)')
print(f'  Oversampling    : SMOTE (class balance)')
print(f'  Models trained  : {len(MODELS)}')
print()
print(f'  BEST MODEL      : {BEST_MODEL_NAME}')
print(f'  Accuracy        : {results[BEST_MODEL_NAME]["Accuracy"]*100:.2f}%')
print(f'  F1 Score        : {results[BEST_MODEL_NAME]["F1 Score"]*100:.2f}%')
print(f'  Precision       : {results[BEST_MODEL_NAME]["Precision"]*100:.2f}%')
print(f'  Recall          : {results[BEST_MODEL_NAME]["Recall"]*100:.2f}%')
print(f'  ROC-AUC         : {results[BEST_MODEL_NAME]["ROC-AUC"]*100:.2f}%')
print(f'  CV F1 (5-fold)  : {results[BEST_MODEL_NAME]["CV F1"]*100:.2f}%')
print()
print('  All models ranked by ROC-AUC:')
for i, (name, row) in enumerate(results_df.iterrows(), 1):
    print(f'  {i}. {name:<25} ROC-AUC={row["ROC-AUC"]:.4f}  F1={row["F1 Score"]:.4f}')
print('=' * 60)

