"use client";

import { useState, useEffect, useRef } from "react";

/* ─── Types ─────────────────────────────────────────── */
type Role = "user" | "assistant";
interface Message { role: Role; content: string; }
interface Stats {
  totalMessages: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  memberSince: string;
}

/* ─── Level config ───────────────────────────────────── */
const LEVELS = [
  { name: "Rookie",    min: 0,   max: 10,  color: "#F59E0B" },
  { name: "Dedicated", min: 11,  max: 25,  color: "#10B981" },
  { name: "Warrior",   min: 26,  max: 50,  color: "#3B82F6" },
  { name: "Champion",  min: 51,  max: 100, color: "#8B5CF6" },
  { name: "Legend",    min: 101, max: Infinity, color: "#00FF87" },
];

function getLevel(msgs: number) {
  return LEVELS.find(l => msgs >= l.min && msgs <= l.max) ?? LEVELS[0];
}
function getLevelIndex(msgs: number) {
  return LEVELS.findIndex(l => msgs >= l.min && msgs <= l.max);
}
function nextLevelAt(msgs: number) {
  const idx = getLevelIndex(msgs);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1].min : null;
}

const today = () => new Date().toISOString().slice(0, 10);

function loadStats(): Stats {
  if (typeof window === "undefined") return defaultStats();
  try {
    const s = localStorage.getItem("fitcoach_stats");
    return s ? JSON.parse(s) : defaultStats();
  } catch { return defaultStats(); }
}
function defaultStats(): Stats {
  return { totalMessages: 0, currentStreak: 1, bestStreak: 1, lastActiveDate: today(), memberSince: today() };
}
function saveStats(s: Stats) { localStorage.setItem("fitcoach_stats", JSON.stringify(s)); }

function bumpStats(s: Stats): Stats {
  const t = today();
  let streak = s.currentStreak;
  if (s.lastActiveDate !== t) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = s.lastActiveDate === yesterday ? streak + 1 : 1;
  }
  return { ...s, totalMessages: s.totalMessages + 1, currentStreak: streak, bestStreak: Math.max(streak, s.bestStreak), lastActiveDate: t };
}

const PROMPTS = [
  "Create a 30-minute HIIT workout",
  "What should I eat after working out?",
  "How do I stay motivated to exercise?",
  "Design a beginner strength routine",
];

/* ─── Component ──────────────────────────────────────── */
export default function FitCoach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setStats(loadStats()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history = [...messages];
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    const prevLevel = getLevelIndex(stats.totalMessages);
    const newStats = bumpStats(stats);
    setStats(newStats);
    saveStats(newStats);
    if (getLevelIndex(newStats.totalMessages) > prevLevel) {
      setLevelUp(LEVELS[getLevelIndex(newStats.totalMessages)].name);
      setTimeout(() => setLevelUp(null), 3000);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: history.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect right now. Make sure n8n is running and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  const level = getLevel(stats.totalMessages);
  const nextAt = nextLevelAt(stats.totalMessages);
  const progress = nextAt ? ((stats.totalMessages - level.min) / (nextAt - level.min)) * 100 : 100;
  const memberDate = new Date(stats.memberSince).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        :root {
          --bg:#0A0A0A; --panel:#111; --border:#1E1E1E;
          --text:#F0EDE8; --muted:#555;
          --accent:#00FF87; --accent-dim:rgba(0,255,135,0.1); --accent-glow:rgba(0,255,135,0.22);
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;overflow:hidden;}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        body::before{content:'';position:fixed;top:-200px;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(0,255,135,0.055) 0%,transparent 70%);pointer-events:none;z-index:0;}
        .shell{position:relative;z-index:1;display:flex;height:100dvh;overflow:hidden;}
        /* Chat */
        .chat-area{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--border);}
        .chat-header{padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}
        .coach-av{width:34px;height:34px;border-radius:50%;background:var(--accent-dim);border:1.5px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;animation:pulse 3s ease-in-out infinite;}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 var(--accent-glow);}50%{box-shadow:0 0 0 7px transparent;}}
        .coach-info h1{font-family:'Syne',sans-serif;font-size:14.5px;font-weight:700;letter-spacing:0.02em;}
        .coach-info p{font-size:11px;color:var(--muted);font-weight:300;}
        .messages{flex:1;overflow-y:auto;padding:24px 24px 0;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
        /* Empty */
        .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:40px;text-align:center;}
        .empty-icon{width:60px;height:60px;border-radius:50%;background:var(--accent-dim);border:2px solid rgba(0,255,135,0.28);display:flex;align-items:center;justify-content:center;font-size:26px;animation:pulse 3s ease-in-out infinite;}
        .empty h2{font-family:'Syne',sans-serif;font-size:19px;font-weight:700;}
        .empty p{font-size:13px;color:var(--muted);font-weight:300;max-width:320px;line-height:1.6;}
        .prompts-lbl{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);}
        .prompts{display:flex;flex-direction:column;gap:7px;width:100%;max-width:360px;}
        .prompt-btn{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:11px 15px;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#999;text-align:left;cursor:pointer;transition:border-color 0.15s,color 0.15s,background 0.15s;font-weight:300;}
        .prompt-btn:hover{border-color:rgba(0,255,135,0.3);color:var(--text);background:var(--accent-dim);}
        /* Messages */
        .msg{display:flex;gap:10px;animation:slideIn 0.22s ease both;}
        @keyframes slideIn{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
        .msg.user{flex-direction:row-reverse;}
        .msg-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px;}
        .msg.user .msg-av{background:var(--accent-dim);border:1px solid rgba(0,255,135,0.22);color:var(--accent);font-size:10px;font-family:'Syne',sans-serif;font-weight:700;}
        .msg.assistant .msg-av{background:#161616;border:1px solid var(--border);}
        .bubble{max-width:72%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.65;font-weight:300;white-space:pre-wrap;}
        .msg.user .bubble{background:#161C14;border:1px solid rgba(0,255,135,0.16);color:var(--text);border-bottom-right-radius:3px;box-shadow:0 0 18px rgba(0,255,135,0.05);}
        .msg.assistant .bubble{background:#131313;border:1px solid var(--border);color:#D0CCC4;border-bottom-left-radius:3px;}
        .typing{display:flex;gap:4px;padding:12px 14px;align-items:center;}
        .dot{width:5px;height:5px;border-radius:50%;background:var(--accent);animation:blink 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:0.2s;}.dot:nth-child(3){animation-delay:0.4s;}
        @keyframes blink{0%,80%,100%{opacity:0.2;transform:scale(0.85);}40%{opacity:1;transform:scale(1.1);}}
        /* Input */
        .input-bar{padding:14px 18px 16px;border-top:1px solid var(--border);display:flex;gap:9px;align-items:flex-end;}
        .input-wrap{flex:1;background:var(--panel);border:1px solid var(--border);border-radius:12px;transition:border-color 0.15s;display:flex;align-items:flex-end;}
        .input-wrap:focus-within{border-color:rgba(0,255,135,0.38);}
        textarea{width:100%;background:transparent;border:none;outline:none;padding:11px 13px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:300;color:var(--text);resize:none;min-height:42px;max-height:130px;line-height:1.55;}
        textarea::placeholder{color:var(--muted);}
        .send-btn{width:38px;height:38px;border-radius:9px;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s,transform 0.1s;}
        .send-btn:hover:not(:disabled){opacity:0.82;}.send-btn:active:not(:disabled){transform:scale(0.93);}
        .send-btn:disabled{opacity:0.28;cursor:not-allowed;}
        .send-btn svg{width:15px;height:15px;fill:#0A0A0A;}
        .hint{text-align:center;font-size:10px;color:#2e2e2e;padding-bottom:4px;font-weight:300;}
        /* Sidebar */
        .sidebar{width:286px;flex-shrink:0;overflow-y:auto;padding:20px 18px;display:flex;flex-direction:column;gap:14px;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
        .sidebar-h{font-family:'Syne',sans-serif;font-size:11.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;}
        .panel{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:16px;}
        /* Level */
        .level-card{display:flex;align-items:center;gap:13px;}
        .level-badge{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:17px;font-weight:800;flex-shrink:0;transition:background 0.3s,border-color 0.3s;}
        .level-info{flex:1;min-width:0;}
        .level-tag{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:1px;}
        .level-name{font-family:'Syne',sans-serif;font-size:19px;font-weight:800;line-height:1;margin-bottom:9px;}
        .prog-track{width:100%;height:3px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:4px;}
        .prog-fill{height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(.4,0,.2,1);}
        .prog-lbl{font-size:10px;color:var(--muted);font-weight:300;}
        /* Stats */
        .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .stat{display:flex;flex-direction:column;gap:3px;}
        .stat-num{display:flex;align-items:baseline;gap:2px;}
        .stat-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-0.02em;}
        .stat-unit{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:400;color:var(--muted);margin-bottom:1px;}
        .stat-lbl{font-size:10.5px;color:var(--muted);font-weight:300;}
        .green{color:var(--accent);}
        .green-unit{color:rgba(0,255,135,0.55);}
        .divider{height:1px;background:var(--border);margin:12px 0 8px;}
        .member-row{display:flex;justify-content:space-between;align-items:center;}
        .member-lbl{font-size:10.5px;color:var(--muted);font-weight:300;}
        .member-val{font-size:10.5px;color:#666;}
        /* Roadmap */
        .roadmap{display:flex;flex-direction:column;}
        .rm-item{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--border);}
        .rm-item:last-child{border-bottom:none;}
        .rm-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10.5px;flex-shrink:0;font-weight:700;font-family:'Syne',sans-serif;}
        .rm-dot.done{background:var(--accent-dim);border:1.5px solid var(--accent);color:var(--accent);}
        .rm-dot.current{border:1.5px solid currentColor;}
        .rm-dot.locked{background:transparent;border:1.5px solid var(--border);color:var(--muted);}
        .rm-info{flex:1;}
        .rm-name{font-family:'Syne',sans-serif;font-size:12.5px;font-weight:700;}
        .rm-range{font-size:10px;color:var(--muted);font-weight:300;}
        .cur-tag{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;background:var(--accent-dim);color:var(--accent);padding:2px 7px;border-radius:20px;border:1px solid rgba(0,255,135,0.18);}
        /* Toast */
        .toast{position:fixed;top:22px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--accent);border-radius:11px;padding:11px 22px;display:flex;align-items:center;gap:9px;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--accent);box-shadow:0 0 36px var(--accent-glow);animation:toastIn 0.38s cubic-bezier(.22,1,.36,1);z-index:100;}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-14px) scale(0.94);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
        @media(max-width:680px){
          html,body{height:auto;overflow-y:auto;}
          .shell{flex-direction:column;height:auto;}
          .chat-area{border-right:none;flex:none;height:60dvh;}
          .chat-header{padding-top:calc(18px + env(safe-area-inset-top,0px));}
          .sidebar{display:flex;flex-direction:column;width:100%;padding:14px 14px 32px;}
        }
      `}</style>

      {levelUp && <div className="toast"><span>🏆</span><span>Level Up — {levelUp}!</span></div>}

      <div className="shell">
        {/* Chat */}
        <div className="chat-area">
          <div className="chat-header">
            <div className="coach-av">🔥</div>
            <div className="coach-info">
              <h1>FitCoach AI</h1>
              <p>Your personal fitness coach</p>
            </div>
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🔥</div>
                <h2>Ready to crush your goals?</h2>
                <p>Start a conversation with your AI fitness coach. Ask about workouts, nutrition, or motivation.</p>
                <span className="prompts-lbl">Try asking</span>
                <div className="prompts">
                  {PROMPTS.map(p => (
                    <button key={p} className="prompt-btn" onClick={() => send(p)}>{p}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  <div className="msg-av">{m.role === "user" ? "U" : "🔥"}</div>
                  <div className="bubble">{m.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="msg assistant">
                <div className="msg-av">🔥</div>
                <div className="bubble"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div>
            <div className="input-bar">
              <div className="input-wrap">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask your coach anything…"
                  rows={1}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 130) + "px";
                  }}
                />
              </div>
              <button className="send-btn" disabled={!input.trim() || loading} onClick={() => send(input)}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
            <p className="hint">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-h">Progress</div>

          <div className="panel">
            <div className="level-card">
              <div className="level-badge" style={{ background:`${level.color}18`, border:`2px solid ${level.color}`, color:level.color }}>
                {getLevelIndex(stats.totalMessages) + 1}
              </div>
              <div className="level-info">
                <div className="level-tag">Level {getLevelIndex(stats.totalMessages) + 1}</div>
                <div className="level-name" style={{ color:level.color }}>{level.name}</div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width:`${progress}%`, background:level.color }}/>
                </div>
                <div className="prog-lbl">
                  {nextAt ? `${stats.totalMessages} / ${nextAt} messages` : "Max level reached"}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="sidebar-h" style={{ marginBottom:12 }}>Your Stats</div>
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-num"><span className="stat-val">{stats.totalMessages}</span></div>
                <span className="stat-lbl">Total Messages</span>
              </div>
              <div className="stat">
                <div className="stat-num">
                  <span className={`stat-val ${stats.currentStreak > 1 ? "green" : ""}`}>{stats.currentStreak}</span>
                  <span className={`stat-unit ${stats.currentStreak > 1 ? "green-unit" : ""}`}>days</span>
                </div>
                <span className="stat-lbl">Current Streak</span>
              </div>
              <div className="stat">
                <div className="stat-num">
                  <span className="stat-val">{stats.bestStreak}</span>
                  <span className="stat-unit">days</span>
                </div>
                <span className="stat-lbl">Best Streak</span>
              </div>
            </div>
            <div className="divider"/>
            <div className="member-row">
              <span className="member-lbl">Member Since</span>
              <span className="member-val">{memberDate}</span>
            </div>
          </div>

          <div className="panel">
            <div className="sidebar-h" style={{ marginBottom:10 }}>Level Roadmap</div>
            <div className="roadmap">
              {LEVELS.map((l, i) => {
                const cur = getLevelIndex(stats.totalMessages);
                const isDone = i < cur, isCur = i === cur;
                return (
                  <div key={l.name} className="rm-item">
                    <div className={`rm-dot ${isDone?"done":isCur?"current":"locked"}`}
                      style={isCur ? { color:l.color, borderColor:l.color, background:`${l.color}18` } : {}}>
                      {i + 1}
                    </div>
                    <div className="rm-info">
                      <div className="rm-name" style={{ color: isDone||isCur ? l.color : "var(--muted)" }}>{l.name}</div>
                      <div className="rm-range">{l.max === Infinity ? `${l.min}+ messages` : `${l.min}–${l.max} messages`}</div>
                    </div>
                    {isCur && <span className="cur-tag">Current</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
