# Rock Paper Scissor Mind Game

An adaptive Rock–Paper–Scissors game with a clean Next.js UI and a FastAPI backend that learns from your behavior. The bot blends simple statistical learning with guardrail heuristics (streak detection, ε-greedy exploration) and only uses psychology prompts when it’s uncertain.

---

## ✨ Features
- Two modes:
  - **Random** – truly uniform randomness (no prompts, no learning)
  - **Psyche** – hybrid predictor (history frequency + streak counter + ε-greedy)
- Smart prompts:
  - Bot mixes *“I will go X”* and *“You will go X”* prompts
  - Prompts only appear on **low confidence** or **mini loss streaks**
  - You **must** answer (Believe / Don’t believe, Will / Will not) before playing
- Win rate excludes draws (W / (W + L))
- Hard-counter on streaks – repeats ≥5 are detected and countered
- Modern UI – centered layout, soft-glass cards, uniform icon buttons, gradient background
- Reset – one click **Reset** (top of the page) clears UI + backend state

---

## 🧭 How it works
The frontend sends recent context (sequence of your last moves + outcomes) to the API.  
The API tracks simple **move frequencies** and applies **ε-greedy** exploration, detects **repeated-move streaks** and hard-counters them, and updates its counts online on every round.  
Frontend decides when to show a **prompt** (uncertain model / small loss streak). You must answer the prompt before you can play that round.  

---

## 🚀 Quick start

### Option A: Docker (recommended)
Requirements: **Docker Desktop**
```bash
docker compose up --build
```
- Web: http://localhost:3000  
- API: http://localhost:8000  

### Option B: Local dev (two terminals)

**Backend (FastAPI)**
```bash
cd api
# (optional) python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000
```

**Frontend (Next.js)**
```bash
cd web
npm i
# ensure .env.local contains:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev  # http://localhost:3000
```

---

## 🖥️ UI Notes
- **Reset button** sits above the header; flushes game + API state
- **Win Rate** shows % and W / L / D (draws not counted in %)
- **Random mode** is truly uniform – no prompts, no learning
- **Psyche mode** uses history + heuristics; prompts appear only when needed
- Icons are in `web/public/icons`. Use equal sizes for uniform buttons.

---

## ⚙️ Configuration
**File:** `web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- ε-greedy exploration constant lives in the frontend (`RpsApiPredictor.tsx`) as `EPSILON = 0.12`
- Streak detection threshold (≥5) is applied in the frontend planner

---

## 🧱 Project scripts
**Web**
- `npm run dev` – Next.js dev server  
- `npm run build` – production build  
- `npm start` – start production server (used in Docker image)  

**API**
- `uvicorn app.main:app --reload`  

**Docker**
- `docker compose up --build`  
- `docker compose down`  

---

## 🧪 Troubleshooting
- **Blank page / 404 to API**: verify `web/.env.local` has the right `NEXT_PUBLIC_API_URL`
- **Windows CRLF warnings**: safe to ignore. To silence: `git config core.autocrlf true`
- **Port already in use**: close existing processes on 3000/8000 or change ports
- **Compose “invalid mount path”**: ensure there is no dangling `docker-compose.override.yml` and your compose file uses valid relative binds (already set in this repo)


---

## 📄 License
MIT — do what you like, a credit link is appreciated.


---

## 📌 Resume-Ready Summary
**Rock Paper Scissor Mind Game** – Built a full-stack interactive game with **FastAPI backend and Next.js frontend**, Dockerized for deployment. Implemented **adaptive prediction using statistical learning, streak detection, and ε-greedy exploration**, with smart psychological prompts. Integrated real-time API endpoints for prediction, online updates, and reset. Designed a modern responsive UI with Tailwind and image-based move selectors.  
*Stack: Python (FastAPI, NumPy), TypeScript (Next.js, React, Tailwind), Docker.*
