# logAI — HCP Interaction Logger (LangGraph Technical Challenge)

This project replicates the provided screenshot:
- Left: Interaction Details form (read-only; you must NOT fill it manually)
- Right: AI Assistant chat (LLM + LangGraph tools) that controls the form

## Tech stack (mandatory)
- Frontend: React + TypeScript + Redux Toolkit (Vite)
- Backend: FastAPI + LangGraph + Groq LLM (`gemma2-9b-it`)
- Database: Postgres (SQLAlchemy + JSONB)

## Prerequisites
- Node.js (LTS)
- Python 3.11+
- Postgres running locally (or any hosted Postgres)
- Groq API key

## Setup env files
This repo ships with a template: `.env.example`.

Backend reads: `backend/.env`

Frontend reads: `frontend/.env` (only `VITE_*` values are used)

### 1) Backend env
```powershell
cd backend
copy ..\.env.example .env
# Edit backend/.env and set:
# - GROQ_API_KEY
# - DATABASE_URL
```

`DATABASE_URL` must use the psycopg driver prefix:

`postgresql+psycopg://USER:PASSWORD@localhost:5432/DBNAME`

### 2) Frontend env
```powershell
cd ..\frontend
copy ..\.env.example .env
```

## Run (local)

### 1) Start backend (FastAPI)
```powershell
cd backend
python -m venv .venv
\.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

### 2) Start frontend (React)
```powershell
cd ..\frontend
npm install
npm run dev
```

Open:
- Frontend: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs

## How to demo (assignment)
1) Log interaction (tool: `log_interaction`)
- Type: "Today I met with Dr. Smith and discussed product X efficacy. The sentiment was positive and I shared the brochures."
- Result: the left form is auto-populated.

2) Edit interaction (tool: `edit_interaction`)
- Type: "Sorry, the name was actually Dr. John and the sentiment was negative."
- Result: only those fields update.

3) Extra tools (to reach 5+ tools total)
- "Reset the form." (tool: `reset_interaction`)
- "Validate this interaction." (tool: `validate_interaction`)
- "Save this interaction." (tool: `save_interaction`)
- "Suggest follow-up actions." (tool: `set_ai_suggested_followups`)

## View saved interactions
Saved interactions are stored in Postgres.

Options:
- In the UI: open the "Saved" dropdown in the Interaction Details title bar (top-right).
  - Search by HCP/date/sentiment
  - Click "Load" to restore the saved form + chat history (so the assistant continues with context)
  - Click "Delete" to remove a saved record
- Swagger: open http://localhost:8000/docs → `GET /api/interactions`
- Swagger detail: `GET /api/interactions/{interaction_id}` returns the saved form state + conversation.
- Swagger delete: `DELETE /api/interactions/{interaction_id}` deletes a saved record.
- SQL (pgAdmin): `SELECT id, created_at, data FROM interactions ORDER BY created_at DESC;`

## Where are the LangGraph tools?
All tools + the LangGraph graph live in:
- `backend/app/agents/interaction_agent.py`

## Safety / GitHub
Do NOT commit real secrets:
- `.env` files are gitignored.
- Put your real `GROQ_API_KEY` only in `backend/.env`.
