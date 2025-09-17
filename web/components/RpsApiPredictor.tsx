"use client";

import React from "react";
import Image from "next/image";

type Move = "Rock" | "Paper" | "Scissors";
type Outcome = "W" | "L" | "D";
type Mode = "random" | "psyche";
type PromptType = "bot" | "you" | null;
type Belief = "believe" | "dont";
type Intent = "will" | "wont";

const MOVES: Move[] = ["Rock", "Paper", "Scissors"];
const ICONS: Record<Move, string> = {
  Rock: "/icons/rock.png",
  Paper: "/icons/paper.png",
  Scissors: "/icons/scissor.png", // <- keep this filename as-is
};

const beats = (a: Move): Move =>
  a === "Rock" ? "Scissors" : a === "Paper" ? "Rock" : "Paper";
const beatenBy = (a: Move): Move =>
  a === "Rock" ? "Paper" : a === "Paper" ? "Scissors" : "Rock";
const randMove = (): Move => MOVES[Math.floor(Math.random() * 3)];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const EPSILON = 0.12; // exploration (fixed default)

/** Pretty card class reused */
const card =
  "rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 shadow-[0_6px_30px_-12px_rgba(0,0,0,0.6)] p-4";

export default function RpsApiPredictor() {
  const [mode, setMode] = React.useState<Mode>("psyche");
  const [round, setRound] = React.useState(1);
  const [history, setHistory] = React.useState<
    {
      player: Move;
      bot: Move;
      result: "Win" | "Lose" | "Draw";
      promptType: PromptType;
      botClaim?: Move;
      youClaim?: Move;
      belief?: Belief;
      intent?: Intent;
    }[]
  >([]);

  // prompt state
  const [promptType, setPromptType] = React.useState<PromptType>(null);
  const [botClaim, setBotClaim] = React.useState<Move>("Rock");
  const [youClaim, setYouClaim] = React.useState<Move>("Paper");
  const [belief, setBelief] = React.useState<Belief | undefined>(undefined);
  const [intent, setIntent] = React.useState<Intent | undefined>(undefined);
  const [cooldown, setCooldown] = React.useState(0);

  // model outputs
  const [botCommit, setBotCommit] = React.useState<Move>("Rock");
  const [probs, setProbs] = React.useState<{ Rock: number; Paper: number; Scissors: number }>({
    Rock: 0.33,
    Paper: 0.33,
    Scissors: 0.33,
  });

  /** last N context of (player, outcome) */
  function context(n: number): (Move | Outcome)[] {
    const ctx: (Move | Outcome)[] = [];
    for (let i = 0; i < Math.min(n, history.length); i++) {
      const h = history[i];
      ctx.push(h.player);
      ctx.push(h.result === "Win" ? "W" : h.result === "Lose" ? "L" : "D");
    }
    return ctx;
  }

  /** how often user follows their own "you will" claim */
  function adherence(): number {
    const recent = history.filter((h) => h.promptType === "you").slice(0, 10);
    if (recent.length === 0) return 0.5;
    let ok = 0;
    for (const r of recent) {
      if (r.intent === "will" && r.player === r.youClaim) ok++;
      if (r.intent === "wont" && r.player !== r.youClaim) ok++;
    }
    return ok / recent.length;
  }

  /** if the user repeats a move ≥5 times, hard-counter it */
  function streakMove(): Move | null {
    const seq = history.slice(0, 10).map((h) => h.player);
    if (seq.length < 5) return null;
    if (seq.every((m) => m === seq[0])) return seq[0];
    let s = 1;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] === seq[0]) s++;
      else break;
    }
    return s >= 5 ? seq[0] : null;
  }

  // plan each round
  React.useEffect(() => {
    setBelief(undefined);
    setIntent(undefined);

    (async () => {
      // when to show a prompt: low confidence or mini loss streak
      const maxProb = Math.max(probs.Rock, probs.Paper, probs.Scissors);
      const recentLosses = history.slice(0, 3).filter((h) => h.result === "Lose").length;
      const stuck = (maxProb < 0.45 || recentLosses >= 2) && cooldown === 0;

      if (mode === "psyche" && stuck) {
        const which: PromptType = Math.random() < 0.5 ? "bot" : "you";
        setPromptType(which);
        if (which === "bot") {
          // bias classic "Rock" claim a bit
          const bag: Move[] = ["Rock", "Rock", "Paper", "Scissors"];
          setBotClaim(bag[Math.floor(Math.random() * bag.length)]);
        } else {
          setYouClaim(MOVES[Math.floor(Math.random() * 3)]);
        }
        setCooldown(2); // avoid every-round prompts
      } else {
        setPromptType(null);
        setCooldown((v) => Math.max(0, v - 1));
      }

      // hard-counter long streaks immediately
      const streak = streakMove();
      if (streak) {
        setBotCommit(beatenBy(streak));
        return;
      }

      // ε-greedy: usually ask server, sometimes explore
      if (Math.random() > EPSILON) {
        try {
          const res = await fetch(`${API}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: context(6),
              prompt_type: promptType,
              adherence: adherence(),
            }),
          });
          const data = await res.json();
          if (data?.probs) setProbs(data.probs);
          setBotCommit((data?.bot_move as Move) ?? randMove());
          return;
        } catch {
          // fall back to heuristic below
        }
      }

      // heuristic if API not used
      if (promptType === "you") {
        const assumed = intent === "will" ? youClaim : beatenBy(youClaim);
        setBotCommit(beatenBy(assumed));
      } else {
        setBotCommit(randMove());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, mode]);

  /** require user to answer the prompt before playing */
  const promptSatisfied = React.useMemo(() => {
    if (!promptType) return true;
    if (promptType === "bot") return typeof belief !== "undefined";
    if (promptType === "you") return typeof intent !== "undefined";
    return true;
  }, [promptType, belief, intent]);

  function decide(player: Move, bot: Move): "Win" | "Lose" | "Draw" {
    if (player === bot) return "Draw";
    return beats(player) === bot ? "Win" : "Lose";
  }

  async function handlePlay(player: Move) {
    if (!promptSatisfied) return;

    let bot = botCommit;
    if (promptType === "you" && youClaim && intent) {
      const assumed = intent === "will" ? youClaim : beatenBy(youClaim);
      bot = beatenBy(assumed);
    } else if (promptType === "bot" && belief && botClaim) {
      if (belief === "believe") bot = beatenBy(beatenBy(botClaim)); // expect user's counter
    }

    const result = decide(player, bot);

    setHistory((h) => [
      {
        player,
        bot,
        result,
        promptType,
        botClaim: promptType === "bot" ? botClaim : undefined,
        youClaim: promptType === "you" ? youClaim : undefined,
        belief: promptType === "bot" ? belief : undefined,
        intent: promptType === "you" ? intent : undefined,
      },
      ...h,
    ]);

    // train backend online
    try {
      await fetch(`${API}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context(6), next_human_move: player }),
      });
    } catch {}

    setRound((r) => r + 1);
  }

  /** ✅ Win rate ignores draws (W / (W + L)) */
  const stats = React.useMemo(() => {
    const wins = history.filter((h) => h.result === "Win").length;
    const losses = history.filter((h) => h.result === "Lose").length;
    const draws = history.filter((h) => h.result === "Draw").length;
    const wlTotal = Math.max(1, wins + losses);
    return {
      wins,
      losses,
      draws,
      winRate: Math.round((wins / wlTotal) * 100),
    };
  }, [history]);

  return (
  <div
    className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6 sm:p-10"
    style={{
      backgroundImage:
        "radial-gradient(900px 480px at 50% -10%, rgba(99,102,241,0.12), transparent 60%), radial-gradient(900px 500px at 120% 0%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(650px 400px at -10% 120%, rgba(16,185,129,0.10), transparent 60%)",
    }}
  >
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* header */}
      <div className="grid gap-4 md:grid-cols-[1fr,220px] items-start">
        <div className="text-center md:text-left">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Rock • Paper • Scissors • Science
          </h1>
          <p className="text-slate-300 mt-2 max-w-2xl mx-auto md:mx-0">
            Smart prompts only when uncertain. Hybrid learner (TF + streak/frequency).
          </p>
        </div>
        <div className={`${card} md:justify-self-end px-5 py-4 text-center`}>
          <div className="text-xs text-slate-300">Win Rate (W/L only)</div>
          <div className="text-4xl font-black leading-tight">{stats.winRate}%</div>
          <div className="text-[11px] text-slate-400 mt-1">
            W {stats.wins} · L {stats.losses} · D {stats.draws}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`${card}`}>
          <div className="text-sm text-slate-300 mb-2">Mode</div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <button
              onClick={() => setMode("psyche")}
              className={`px-4 py-2 rounded-xl border ${
                mode === "psyche"
                  ? "bg-slate-100 text-slate-900 border-slate-200"
                  : "bg-slate-800 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Psyche
            </button>
            <button
              onClick={() => setMode("random")}
              className={`px-4 py-2 rounded-xl border ${
                mode === "random"
                  ? "bg-slate-100 text-slate-900 border-slate-200"
                  : "bg-slate-800 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Random
            </button>
          </div>
          <div className="text-xs text-slate-400 mt-3 text-center sm:text-left">
            Prompts show only when model confidence is low or after mini loss streaks.
          </div>
        </div>

        <div className={`${card}`}>
          <div className="text-sm text-slate-300 mb-2">Model status</div>
          <div className="text-sm text-slate-300">
            Blends TF with frequency; detects streaks ≥ 5 and hard-counters.
          </div>
        </div>
      </div>

      {/* prompt */}
      {promptType && (
        <div className={`${card} border-emerald-900/40`}>
          {promptType === "bot" ? (
            <>
              <div className="text-xs text-slate-400">Prompt</div>
              <div className="text-2xl font-semibold">
                I will go{" "}
                <span className="underline decoration-dashed decoration-2 underline-offset-4">
                  {botClaim}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setBelief("believe")}
                  className={`px-4 py-2 rounded-xl ${
                    belief === "believe"
                      ? "bg-emerald-400 text-slate-900"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  I believe you
                </button>
                <button
                  onClick={() => setBelief("dont")}
                  className={`px-4 py-2 rounded-xl ${
                    belief === "dont"
                      ? "bg-rose-400 text-slate-900"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  I don’t believe you
                </button>
              </div>
              {!belief && (
                <div className="text-xs text-amber-400 mt-2">Please choose one to continue.</div>
              )}
            </>
          ) : (
            <>
              <div className="text-xs text-slate-400">Prompt</div>
              <div className="text-2xl font-semibold">
                You will go{" "}
                <span className="underline decoration-dashed decoration-2 underline-offset-4">
                  {youClaim}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setIntent("will")}
                  className={`px-4 py-2 rounded-xl ${
                    intent === "will"
                      ? "bg-emerald-400 text-slate-900"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  I will
                </button>
                <button
                  onClick={() => setIntent("wont")}
                  className={`px-4 py-2 rounded-xl ${
                    intent === "wont"
                      ? "bg-amber-400 text-slate-900"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  I will not
                </button>
              </div>
              {!intent && (
                <div className="text-xs text-amber-400 mt-2">Please choose one to continue.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* move buttons */}
      <div className="grid grid-cols-3 gap-5 place-items-center">
        {MOVES.map((m) => (
          <button
            key={m}
            onClick={() => handlePlay(m)}
            disabled={!promptSatisfied}
            className={`group aspect-square w-36 sm:w-40 rounded-3xl border border-slate-800 bg-slate-100 text-slate-900 hover:bg-white active:scale-[0.98] shadow hover:shadow-lg transition-all ${
              !promptSatisfied ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={m}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-24 h-24 rounded-full ring-1 ring-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 grid place-items-center">
                <Image
                  src={ICONS[m]}
                  alt={m}
                  width={96}
                  height={96}
                  className="object-contain select-none"
                  draggable={false}
                  priority
                />
              </div>
              <div className="font-semibold">{m}</div>
            </div>
          </button>
        ))}
      </div>

      {/* last round */}
      {history[0] && (
        <div className={`${card}`}>
          <div className="text-sm text-slate-300">Last round</div>
          <div className="mt-1 text-lg">
            You chose <span className="font-semibold">{history[0].player}</span>, bot chose{" "}
            <span className="font-semibold">{history[0].bot}</span> —{" "}
            <span
              className={`ml-1 font-bold ${
                history[0].result === "Win"
                  ? "text-emerald-400"
                  : history[0].result === "Lose"
                  ? "text-rose-400"
                  : "text-slate-200"
              }`}
            >
              {history[0].result}
            </span>
          </div>
        </div>
      )}

      {/* history */}
      <div className={`${card} overflow-hidden`}>
        <div className="max-h-80 overflow-auto rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/70 text-slate-300 sticky top-0">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Your Move</th>
                <th className="px-4 py-2">Bot Move</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">Prompt</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="odd:bg-slate-950/40 even:bg-slate-900/40">
                  <td className="px-4 py-2">{history.length - i}</td>
                  <td className="px-4 py-2">{h.player}</td>
                  <td className="px-4 py-2">{h.bot}</td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      h.result === "Win"
                        ? "text-emerald-400"
                        : h.result === "Lose"
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {h.result}
                  </td>
                  <td className="px-4 py-2">
                    {h.promptType === "bot"
                      ? "I will go ..."
                      : h.promptType === "you"
                      ? "You will go ..."
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {h.promptType === "bot" &&
                      (h.belief
                        ? `bot said ${h.botClaim}; you ${
                            h.belief === "believe" ? "believed" : "didn't believe"
                          }`
                        : "—")}
                    {h.promptType === "you" &&
                      (h.intent ? `you ${h.intent === "will" ? "will" : "will not"} ${h.youClaim}` : "—")}
                    {!h.promptType && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Hybrid prediction (streak ≥5 hard-counter • TF/frequency blend) • Prompts only when stuck • Uniform PNG buttons
      </p>
    </div>
  </div>
);
}
