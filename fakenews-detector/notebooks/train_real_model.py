import os
import json
import numpy as np
import pandas as pd
from datasets import load_dataset
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, roc_auc_score)
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
import pickle
import warnings
warnings.filterwarnings("ignore")

# CONFIG
USE_BERT = False        
SAVE_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'model')
os.makedirs(SAVE_DIR, exist_ok=True)

# Load LIAR Dataset

print("\n[1/5] Loading LIAR dataset from HuggingFace...")
print("      (Downloads ~3MB, first time only)\n")

dataset = load_dataset("liar")
print(f"  Train samples : {len(dataset['train'])}")
print(f"  Test  samples : {len(dataset['test'])}")
print(f"  Valid samples : {len(dataset['validation'])}")
print(f"\n  Columns: {dataset['train'].column_names}")


# Preprocess
print("\n[2/5] Preprocessing labels...")

# LIAR has 6 labels: pants-fire, false, barely-true, half-true, mostly-true, true
# bin them into FAKE (0) and REAL (1)
FAKE_LABELS = {"pants-fire", "false", "barely-true"}
REAL_LABELS = {"half-true", "mostly-true", "true"}

def binarize(label):
    return 0 if label in FAKE_LABELS else 1

def to_df(split):
    df = pd.DataFrame(split)
    # Combine statement + speaker + subject for richer features
    df['text'] = (
        df['statement'].fillna('') + ' ' +
        df['speaker'].fillna('') + ' ' +
        df['subjects'].fillna('')
    )
    df['label_bin'] = df['label'].apply(binarize)
    return df[['text', 'label_bin', 'label', 'statement', 'speaker']]

train_df = to_df(dataset['train'])
test_df  = to_df(dataset['test'])
val_df   = to_df(dataset['validation'])

print(f"\n  Binary label distribution (train):")
print(train_df['label_bin'].value_counts().rename({0:'FAKE', 1:'REAL'}))

# Train Baseline Models (always run, fast)
print("\n[3/5] Training baseline models...")

X_train = train_df['text']
y_train = train_df['label_bin']
X_test  = test_df['text']
y_test  = test_df['label_bin']

# Model 1: Logistic Regression 
print("  Training Logistic Regression...")
lr_pipe = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2),
                              stop_words='english', sublinear_tf=True)),
    ('clf', LogisticRegression(max_iter=1000, C=1.0, class_weight='balanced'))
])
lr_pipe.fit(X_train, y_train)
lr_pred = lr_pipe.predict(X_test)
lr_prob = lr_pipe.predict_proba(X_test)[:, 1]
lr_acc  = accuracy_score(y_test, lr_pred)
lr_auc  = roc_auc_score(y_test, lr_prob)
print(f"  LR  → Accuracy: {lr_acc:.4f}  AUC: {lr_auc:.4f}")

# Model 2: Random Forest 
print("  Training Random Forest (this takes ~2 min)...")
rf_pipe = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2),
                              stop_words='english', sublinear_tf=True)),
    ('clf', RandomForestClassifier(n_estimators=200, random_state=42,
                                   class_weight='balanced', n_jobs=-1))
])
rf_pipe.fit(X_train, y_train)
rf_pred = rf_pipe.predict(X_test)
rf_prob = rf_pipe.predict_proba(X_test)[:, 1]
rf_acc  = accuracy_score(y_test, rf_pred)
rf_auc  = roc_auc_score(y_test, rf_prob)
print(f"  RF  → Accuracy: {rf_acc:.4f}  AUC: {rf_auc:.4f}")

# Pick the best baseline
best_model = rf_pipe if rf_acc >= lr_acc else lr_pipe
best_name  = "Random Forest" if rf_acc >= lr_acc else "Logistic Regression"
best_acc   = max(rf_acc, lr_acc)
print(f"\n  Best baseline: {best_name} ({best_acc:.4f})")

# Save best baseline
baseline_path = os.path.join(SAVE_DIR, 'baseline_model.pkl')
with open(baseline_path, 'wb') as f:
    pickle.dump(best_model, f)
print(f"  Saved → {baseline_path}")

# Fine-tune BERT 
bert_acc = None
if USE_BERT:
    print("\n[4/5] Fine-tuning BERT (bert-base-uncased)...")
    print("      This requires ~4GB RAM and takes 20-40 min on CPU.\n")
    try:
        import torch
        from transformers import (BertTokenizer, BertForSequenceClassification,
                                  Trainer, TrainingArguments)
        from torch.utils.data import Dataset as TorchDataset

        tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')

        class LIARDataset(TorchDataset):
            def __init__(self, texts, labels, tokenizer, max_len=128):
                self.encodings = tokenizer(
                    list(texts), truncation=True, padding=True,
                    max_length=max_len, return_tensors='pt'
                )
                self.labels = torch.tensor(list(labels), dtype=torch.long)
            def __len__(self):
                return len(self.labels)
            def __getitem__(self, idx):
                item = {k: v[idx] for k, v in self.encodings.items()}
                item['labels'] = self.labels[idx]
                return item

        # Use a subset for speed on CPU
        MAX_TRAIN = 5000 if not torch.cuda.is_available() else len(train_df)
        MAX_TEST  = 1000 if not torch.cuda.is_available() else len(test_df)

        train_sub = train_df.sample(min(MAX_TRAIN, len(train_df)), random_state=42)
        test_sub  = test_df.sample(min(MAX_TEST,  len(test_df)),  random_state=42)

        train_ds = LIARDataset(train_sub['text'], train_sub['label_bin'], tokenizer)
        test_ds  = LIARDataset(test_sub['text'],  test_sub['label_bin'],  tokenizer)

        model = BertForSequenceClassification.from_pretrained(
            'bert-base-uncased', num_labels=2
        )

        args = TrainingArguments(
            output_dir=os.path.join(SAVE_DIR, 'bert_checkpoints'),
            num_train_epochs=3,
            per_device_train_batch_size=16,
            per_device_eval_batch_size=32,
            evaluation_strategy='epoch',
            save_strategy='epoch',
            load_best_model_at_end=True,
            logging_steps=50,
            report_to='none',
        )

        trainer = Trainer(
            model=model,
            args=args,
            train_dataset=train_ds,
            eval_dataset=test_ds,
        )

        trainer.train()

        # Evaluate
        preds_out = trainer.predict(test_ds)
        bert_preds = np.argmax(preds_out.predictions, axis=1)
        bert_acc   = accuracy_score(test_sub['label_bin'], bert_preds)
        print(f"\n  BERT → Accuracy: {bert_acc:.4f}")

        # Save BERT model
        bert_dir = os.path.join(SAVE_DIR, 'bert')
        model.save_pretrained(bert_dir)
        tokenizer.save_pretrained(bert_dir)
        print(f"  Saved BERT → {bert_dir}")

    except Exception as e:
        print(f"  BERT training failed: {e}")
        print("  Falling back to baseline model.")
        USE_BERT = False
else:
    print("\n[4/5] Skipping BERT (USE_BERT=False)")
    print("      Set USE_BERT=True at top of file to enable.")

# Save metadata for the Flask app
print("\n[5/5] Saving model metadata...")

meta = {
    "use_bert": USE_BERT and bert_acc is not None,
    "best_baseline": best_name,
    "lr_accuracy":   round(float(lr_acc), 4),
    "lr_auc":        round(float(lr_auc), 4),
    "rf_accuracy":   round(float(rf_acc), 4),
    "rf_auc":        round(float(rf_auc), 4),
    "bert_accuracy": round(float(bert_acc), 4) if bert_acc else None,
    "dataset": "LIAR (HuggingFace)",
    "train_size": len(train_df),
    "test_size":  len(test_df),
    "label_mapping": {"0": "FAKE", "1": "REAL"},
    "fake_labels": list(FAKE_LABELS),
    "real_labels": list(REAL_LABELS),
}

meta_path = os.path.join(SAVE_DIR, 'model_meta.json')
with open(meta_path, 'w') as f:
    json.dump(meta, f, indent=2)
print(f"  Saved → {meta_path}")

print("\n" + "="*55)
print("  TRAINING COMPLETE")
print("="*55)
print(f"  Logistic Regression : {lr_acc:.4f} accuracy")
print(f"  Random Forest       : {rf_acc:.4f} accuracy")
if bert_acc:
    print(f"  BERT (fine-tuned)   : {bert_acc:.4f} accuracy")
print(f"\n  Model files saved to: backend/model/")
print("="*55 + "\n")
