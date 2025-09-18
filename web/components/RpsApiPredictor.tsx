"use client";

import React from "react";
import Image from "next/image";

/* ── Types ────────────────────────────────────────────────────────────── */
type Move = "Rock" | "Paper" | "Scissors";
type Outcome = "W" | "L" | "D";
type Mode = "random" | "psyche";
type PromptType = "bot" | "you" | null;
type Belief = "believe" | "dont";
type Intent = "will" | "wont";

/* ── Constants ────────────────────────────────────────────────────────── */
const MOVES: Move[] = ["Rock", "Paper", "Scissors"];
const ICONS: Record<Move, string> = {
  Rock: "/icons/rock.png",
  Paper: "/icons/paper.png",
  Scissors: "/icons/scissor.png",
};

const beats = (a: Move): Move =>
  a === "Rock" ? "Scissors" : a === "Paper" ? "Rock" : "Paper";
const beatenBy = (a: Move): Move =>
  a === "Rock" ? "Paper" : a === "Paper" ? "Scissors" : "Rock";
const randMove = (): Move => MOVES[Math.floor(Math.random() * 3)];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const EPSILON = 0.12;

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

  const [promptType, setPromptType] = React.useState<PromptType>(null);
  const [botClaim, setBotClaim] = React.useState<Move>("Rock");
  const [youClaim, setYouClaim] = React.useState<Move>("Paper");
  const [belief, setBelief] = React.useState<Belief | undefined>(undefined);
  const [intent, setIntent] = React.useState<Intent | undefined>(undefined);
  const [cooldown, setCooldown] = React.useState(0);

  const [botCommit, setBotCommit] = React.useState<Move>("Rock");
  const [probs, setProbs] = React.useState<{ Rock: number; Paper: number; Scissors: number }>({
    Rock: 0.33,
    Paper: 0.33,
    Scissors: 0.33,
  });

  const [isPlaying, setIsPlaying] = React.useState(false);

  /* helpers - YOUR EXACT LOGIC */
  function context(n: number): (Move | Outcome)[] {
    const ctx: (Move | Outcome)[] = [];
    for (let i = 0; i < Math.min(n, history.length); i++) {
      const h = history[i];
      ctx.push(h.player);
      ctx.push(h.result === "Win" ? "W" : h.result === "Lose" ? "L" : "D");
    }
    return ctx;
  }

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

  function streakMove(): Move | null {
    const seq = history.slice(0, 10).map((h) => h.player);
    if (seq.length < 5) return null;
    let s = 1;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] === seq[0]) s++;
      else break;
    }
    return s >= 5 ? seq[0] : null;
  }

  React.useEffect(() => {
    setBelief(undefined);
    setIntent(undefined);

    (async () => {
      if (mode === "random") {
        setPromptType(null);
        setBotCommit(randMove());
        return;
      }

      const maxProb = Math.max(probs.Rock, probs.Paper, probs.Scissors);
      const recentLosses = history.slice(0, 3).filter((h) => h.result === "Lose").length;
      const stuck = (maxProb < 0.45 || recentLosses >= 2) && cooldown === 0;

      if (stuck) {
        const which: PromptType = Math.random() < 0.5 ? "bot" : "you";
        setPromptType(which);
        if (which === "bot") {
          const bag: Move[] = ["Rock", "Rock", "Paper", "Scissors"];
          setBotClaim(bag[Math.floor(Math.random() * bag.length)]);
        } else {
          setYouClaim(randMove());
        }
        setCooldown(2);
      } else {
        setPromptType(null);
        setCooldown((v) => Math.max(0, v - 1));
      }

      const streak = streakMove();
      if (streak) {
        setBotCommit(beatenBy(streak));
        return;
      }

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
        } catch {}
      }

      if (promptType === "you" && youClaim) {
        const assumed = intent === "will" ? youClaim : beatenBy(youClaim);
        setBotCommit(beatenBy(assumed));
      } else {
        setBotCommit(randMove());
      }
    })();
  }, [round, mode]);

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
    
    setIsPlaying(true);
    
    let bot = botCommit;

    if (mode === "psyche") {
      if (promptType === "you" && youClaim && intent) {
        const assumed = intent === "will" ? youClaim : beatenBy(youClaim);
        bot = beatenBy(assumed);
      } else if (promptType === "bot" && belief && botClaim) {
        if (belief === "believe") bot = beatenBy(beatenBy(botClaim));
      }
    }

    const result = decide(player, bot);

    const thinkingTime = mode === "random" ? 0 : 200; // No delay for random, 500ms for psyche
    
    setTimeout(() => {
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

      setIsPlaying(false);

      if (mode === "psyche") {
        try {
          fetch(`${API}/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context: context(6), next_human_move: player }),
          });
        } catch {}
      }

      setRound((r) => r + 1);
    }, thinkingTime);
  }

  async function handleReset() {
    setHistory([]);
    setRound((r) => r + 1);
    setBelief(undefined);
    setIntent(undefined);
    setPromptType(null);

    try {
      await fetch(`${API}/reset`, { method: "POST" });
    } catch {}
  }

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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a2e',
      color: '#eee',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: '#fff' }}>
            Rock Paper Scissors Mind Game
          </h1>
          <p style={{ color: '#bbb', margin: '0' }}>Hybrid ML + Behavioral Analysis</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: '30px' }}>
          
          {/* Left Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Mode Selection */}
            <div style={{
              backgroundColor: '#2a2a4a',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Game Mode</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => setMode("psyche")}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: mode === "psyche" ? '#4f46e5' : '#374151',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Psyche Mode
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Smart prompts & learning</div>
                </button>
                <button
                  onClick={() => setMode("random")}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: mode === "random" ? '#059669' : '#374151',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Random Mode
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Pure randomness</div>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              backgroundColor: '#2a2a4a',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: '0', fontSize: '1.1rem' }}>Statistics</h3>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Reset
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>{stats.winRate}%</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Win Rate</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{history.length}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Games</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#4ade80' }}>{stats.wins}</div>
                  <div style={{ fontSize: '12px' }}>Wins</div>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#f87171' }}>{stats.losses}</div>
                  <div style={{ fontSize: '12px' }}>Loss</div>
                </div>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>{stats.draws}</div>
                  <div style={{ fontSize: '12px' }}>Draw</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Game Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Prompt */}
            {mode === "psyche" && promptType && (
              <div style={{
                backgroundColor: 'rgba(126, 34, 206, 0.1)',
                border: '1px solid rgba(126, 34, 206, 0.3)',
                borderRadius: '12px',
                padding: '25px',
                textAlign: 'center'
              }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#c084fc', marginBottom: '10px' }}>AI PROMPT</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {promptType === "bot" ? (
                      <>I will choose <span style={{ color: '#c084fc' }}>{botClaim}</span></>
                    ) : (
                      <>You will choose <span style={{ color: '#60a5fa' }}>{youClaim}</span></>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  {promptType === "bot" ? (
                    <>
                      <button
                        onClick={() => setBelief("believe")}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: belief === "believe" ? '#059669' : '#374151',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        I believe you
                      </button>
                      <button
                        onClick={() => setBelief("dont")}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: belief === "dont" ? '#dc2626' : '#374151',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        I don't believe
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIntent("will")}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: intent === "will" ? '#059669' : '#374151',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        I will
                      </button>
                      <button
                        onClick={() => setIntent("wont")}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: intent === "wont" ? '#ea580c' : '#374151',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        I won't
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Game Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px' }}>
              {MOVES.map((move) => (
                <button
                  key={move}
                  onClick={() => handlePlay(move)}
                  disabled={!promptSatisfied || isPlaying}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '30px',
                    cursor: promptSatisfied && !isPlaying ? 'pointer' : 'not-allowed',
                    opacity: promptSatisfied && !isPlaying ? 1 : 0.5,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'transform 0.2s',
                    transform: 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (promptSatisfied && !isPlaying) {
                      (e.target as HTMLElement).style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  <Image
                    src={ICONS[move]}
                    alt={move}
                    width={80}
                    height={80}
                    style={{ marginBottom: '15px' }}
                  />
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{move}</span>
                </button>
              ))}
            </div>

            {/* Last Round */}
            {history[0] && (
              <div style={{
                backgroundColor: '#2a2a4a',
                borderRadius: '12px',
                padding: '25px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>Last Round</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Image
                      src={ICONS[history[0].player]}
                      alt={history[0].player}
                      width={60}
                      height={60}
                      style={{ marginBottom: '10px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>You</div>
                    <div style={{ fontWeight: '600' }}>{history[0].player}</div>
                  </div>
                  <div style={{ fontSize: '2rem' }}>VS</div>
                  <div style={{ textAlign: 'center' }}>
                    <Image
                      src={ICONS[history[0].bot]}
                      alt={history[0].bot}
                      width={60}
                      height={60}
                      style={{ marginBottom: '10px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>AI</div>
                    <div style={{ fontWeight: '600' }}>{history[0].bot}</div>
                  </div>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  marginTop: '20px',
                  color: history[0].result === "Win" ? '#4ade80' : 
                        history[0].result === "Lose" ? '#f87171' : '#fbbf24'
                }}>
                  {history[0].result === "Win" ? "You Won!" : 
                   history[0].result === "Lose" ? "AI Won!" : "Draw!"}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - History */}
          <div>
            <div style={{
              backgroundColor: '#2a2a4a',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem' }}>History</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {history.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>No games yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {history.slice(0, 20).map((game, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: '#374151',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#9ca3af' }}>#{history.length - i}</span>
                          <Image src={ICONS[game.player]} alt="" width={20} height={20} />
                          <span style={{ color: '#6b7280' }}>vs</span>
                          <Image src={ICONS[game.bot]} alt="" width={20} height={20} />
                        </div>
                        <span style={{
                          fontWeight: 'bold',
                          color: game.result === "Win" ? '#4ade80' : 
                                game.result === "Lose" ? '#f87171' : '#fbbf24'
                        }}>
                          {game.result[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isPlaying && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#2a2a4a',
              borderRadius: '12px',
              padding: '25px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '4px solid #4f46e5',
                borderTop: '4px solid transparent',
                borderRadius: '50%',
                margin: '0 auto 15px',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ margin: '0' }}>AI thinking...</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}