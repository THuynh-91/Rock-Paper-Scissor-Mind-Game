# Rock Paper Scissor Mind Game

An adaptive Rock–Paper–Scissors game with a clean Next.js UI and a FastAPI backend that learns from your behavior. The bot blends simple statistical learning with guardrail heuristics (streak detection, ε-greedy exploration) and only uses psychology prompts when it’s uncertain.<br>

Site: https://rock-paper-scissor-mind-game.vercel.app

---

## Features
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

##How it works
The frontend sends recent context (sequence of your last moves + outcomes) to the API.  
The API tracks simple **move frequencies** and applies **ε-greedy** exploration, detects **repeated-move streaks** and hard-counters them, and updates its counts online on every round.  
Frontend decides when to show a **prompt** (uncertain model / small loss streak). You must answer the prompt before you can play that round.  

---

## How to Run

Requirements: **Docker Desktop**
```bash
docker compose up --build
```
- Web: http://localhost:3000  
- API: http://localhost:8000  

---

## UI Notes
- **Reset button** sits above the header; flushes game + API state
- **Win Rate** shows % and W / L / D (draws not counted in %)
- **Random mode** is truly uniform – no prompts, no learning
- **Psyche mode** uses history + heuristics; prompts appear only when needed
- Icons are in `web/public/icons`. Use equal sizes for uniform buttons.

---

## Configuration
**File:** `web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- ε-greedy exploration constant lives in the frontend (`RpsApiPredictor.tsx`) as `EPSILON = 0.12`
- Streak detection threshold (≥5) is applied in the frontend planner

---

## Project scripts
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

## License
MIT — do what you like, a credit link is appreciated.


