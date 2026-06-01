import os, json, pickle, warnings
import numpy as np
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.ensemble import VotingClassifier

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.base import BaseEstimator, TransformerMixin

import scipy.sparse as sp

warnings.filterwarnings("ignore")

# CONFIG

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "..", "backend", "model")
os.makedirs(MODEL_DIR, exist_ok=True)

TRAIN_FILE = os.path.join(DATA_DIR, "train2.tsv")
TEST_FILE  = os.path.join(DATA_DIR, "test2.tsv")
VALID_FILE = os.path.join(DATA_DIR, "valid2.tsv")

COLS = [
    'id','label','statement','subjects','speaker','job',
    'state','party','barely_true_c','false_c','half_true_c',
    'mostly_true_c','pants_fire_c','context'
]

FAKE_LABELS = {'pants-fire', 'false', 'barely-true'}

print("\n" + "="*60)
print("VerifyAI Training Started")
print("="*60)

# ─────────────────────────────────────────────
# CHECK FILES
# ─────────────────────────────────────────────
for f in [TRAIN_FILE, TEST_FILE, VALID_FILE]:
    if not os.path.exists(f):
        print(" Missing dataset files!")
        exit()

print("Dataset found")

# LOAD DATA

def load_data(path):
    df = pd.read_csv(path, sep="\t", header=None, names=COLS, on_bad_lines='skip')

    df["label_bin"] = df["label"].apply(
        lambda x: 0 if str(x).strip() in FAKE_LABELS else 1
    )

    df["text"] = (
        df["statement"].fillna("") + " " +
        df["context"].fillna("") + " " +
        df["subjects"].fillna("")
    )

    df["speaker"] = df["speaker"].fillna("unknown")
    df["party"] = df["party"].fillna("none")

    hist_cols = ['barely_true_c','false_c','half_true_c','mostly_true_c','pants_fire_c']
    for c in hist_cols:
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)

    df["lie_ratio"] = (df["false_c"] + df["barely_true_c"] + df["pants_fire_c"]) / (df[hist_cols].sum(axis=1) + 1)

    return df

train_df = load_data(TRAIN_FILE)
test_df  = load_data(TEST_FILE)
val_df   = load_data(VALID_FILE)

train_df = pd.concat([train_df, val_df], ignore_index=True)

print(f"Train samples: {len(train_df)}")
print(f"Test samples : {len(test_df)}")

# FEATURES

class ColumnSelector(BaseEstimator, TransformerMixin):
    def __init__(self, col): self.col = col
    def fit(self, X, y=None): return self
    def transform(self, X): return X[self.col]

class NumericSelector(BaseEstimator, TransformerMixin):
    def __init__(self, cols): self.cols = cols
    def fit(self, X, y=None): return self
    def transform(self, X): return X[self.cols].values.astype(float)

NUM_COLS = ['barely_true_c','false_c','half_true_c','mostly_true_c','pants_fire_c','lie_ratio']

text_pipe = Pipeline([
    ("sel", ColumnSelector("text")),
    ("tfidf", TfidfVectorizer(max_features=20000, ngram_range=(1,2)))
])

speaker_pipe = Pipeline([
    ("sel", ColumnSelector("speaker")),
    ("tfidf", TfidfVectorizer(max_features=300))
])

num_pipe = Pipeline([
    ("sel", NumericSelector(NUM_COLS)),
    ("scaler", StandardScaler())
])

class Features:
    def fit(self, X, y=None):
        self.t = text_pipe.fit(X)
        self.s = speaker_pipe.fit(X)
        self.n = num_pipe.fit(X)
        return self

    def transform(self, X):
        t = self.t.transform(X)
        s = self.s.transform(X)
        n = self.n.transform(X)
        return sp.hstack([t, s, sp.csr_matrix(n)])

features = Features()

X_train = features.fit(train_df).transform(train_df)
X_test  = features.transform(test_df)

y_train = train_df["label_bin"].values
y_test  = test_df["label_bin"].values

# MODEL EVALUATION FUNCTION

def evaluate(name, model):
    pred = model.predict(X_test)
    acc = accuracy_score(y_test, pred)

    auc = 0
    if hasattr(model, "predict_proba"):
        auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])

    print("\n" + "-"*50)
    print(f"Model: {name}")
    print(f"Accuracy: {acc:.4f}")
    print(f"AUC: {auc:.4f}")
    print("-"*50)

    return model, acc

# TRAIN MODELS

print("\nTraining Models...\n")

results = {}

lr = LogisticRegression(max_iter=1000, class_weight="balanced")
lr, acc_lr = evaluate("Logistic Regression", lr.fit(X_train, y_train))
results["Logistic Regression"] = (lr, acc_lr)

rf = RandomForestClassifier(n_estimators=300, class_weight="balanced")
rf, acc_rf = evaluate("Random Forest", rf.fit(X_train, y_train))
results["Random Forest"] = (rf, acc_rf)

gb = GradientBoostingClassifier()
gb, acc_gb = evaluate("Gradient Boosting", gb.fit(X_train, y_train))
results["Gradient Boosting"] = (gb, acc_gb)

# ENSEMBLE

top2 = sorted(results.items(), key=lambda x: x[1][1], reverse=True)[:2]

ensemble = VotingClassifier(
    estimators=[(name, model) for name, (model, _) in top2],
    voting="soft"
)

ensemble.fit(X_train, y_train)
ensemble, acc_en = evaluate("Ensemble", ensemble)

results["Ensemble"] = (ensemble, acc_en)

# FINAL SUMMARY

print("\n" + "="*60)
print("FINAL RESULTS")
print("="*60)

for name, (model, acc) in sorted(results.items(), key=lambda x: x[1][1], reverse=True):
    print(f"{name:<20} ➜ {acc:.4f}")

best_name = max(results, key=lambda k: results[k][1])
best_model = results[best_name][0]

print("\ BEST MODEL:", best_name)
print("BEST ACCURACY:", results[best_name][1])
print("="*60)

# SAVE MODEL

with open(os.path.join(MODEL_DIR, "model.pkl"), "wb") as f:
    pickle.dump(best_model, f)

print("\Model saved successfully!")
print("Ready for Flask deployment")
