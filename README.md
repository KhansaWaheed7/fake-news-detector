# VerifyAI 

> *Don't share before you verify.*

**Team:** Khansa Waheed (230982) · Momna Nawaz (23081) · Areeba Jilani (230904)  
**Course:** Artificial Intelligence  
**Deadline:** June 01, 2026

---

## Quick Start (Run Locally)

**Step 1 — Backend**
```bash
cd backend
pip install -r requirements.txt
python app.py
# Backend runs at http://localhost:5000
```

**Step 2 — Frontend**
```bash
# Simply open frontend/index.html in your browser
# OR serve it:
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

---

## Project Structure
```
fakenews-detector/
├── frontend/
│   └── index.html          # Complete 5-page React-style SPA
├── backend/
│   ├── app.py              # Flask REST API
│   └── requirements.txt
├── notebooks/
│   └── model_training.ipynb  # EDA + Model training
├── report/                 # Project report (PDF)
├── demo/                   # Video demo link
└── README.md
```

## Features
- NLP text classifier 
- Highlighted suspicious phrases (clickbait / hedging / emotional)
- Credibility score dial (0–100)
- Fact-check cross-reference 
- Web presence timeline
- Dashboard with charts and history
- Model analytics page

