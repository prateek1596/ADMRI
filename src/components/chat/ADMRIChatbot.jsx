// src/components/chat/ADMRIChatbot.jsx
// Rebuilt with: clinical context awareness, conversation memory,
// domain-specific opening, structured exercises, live sentiment tracking,
// session summary generation, risk-adaptive responses
import { useState, useRef, useEffect, useCallback } from "react";
import { intentClassifier } from "../../ml/ClinicalDataset";
import { analyzeSentiment } from "../../ml/ADMRIEngine";

// ── Breathing exercise animator ───────────────────────────────────────────────
function BreathingExercise({ type = "box", onDone }) {
  const PHASES = {
    box:     [{ label: "Breathe in",  duration: 4000, color: "#58A6FF" },
              { label: "Hold",        duration: 4000, color: "#BC8CFF" },
              { label: "Breathe out", duration: 4000, color: "#3FB950" },
              { label: "Hold",        duration: 4000, color: "#E3B341" }],
    "4-7-8": [{ label: "Breathe in",  duration: 4000, color: "#58A6FF" },
              { label: "Hold",        duration: 7000, color: "#BC8CFF" },
              { label: "Breathe out", duration: 8000, color: "#3FB950" }],
  };
  const phases = PHASES[type] || PHASES.box;
  const [phaseIdx,  setPhaseIdx]  = useState(0);
  const [progress,  setProgress]  = useState(0);
  const [cycles,    setCycles]    = useState(0);
  const [done,      setDone]      = useState(false);
  const totalCycles = 3;
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    startRef.current = performance.now();
    function tick(now) {
      const elapsed  = now - startRef.current;
      const duration = phases[phaseIdx].duration;
      const pct      = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct < 1) { rafRef.current = requestAnimationFrame(tick); return; }
      const nextPhase = (phaseIdx + 1) % phases.length;
      const nextCycles = nextPhase === 0 ? cycles + 1 : cycles;
      if (nextCycles >= totalCycles) { setDone(true); return; }
      setCycles(nextCycles);
      setPhaseIdx(nextPhase);
      setProgress(0);
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phaseIdx, cycles]);

  const phase = phases[phaseIdx];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const scale = type === "box"
    ? phaseIdx === 0 ? 1 + progress * 0.4
    : phaseIdx === 2 ? 1.4 - progress * 0.4
    : phaseIdx === 1 ? 1.4 : 1
    : phaseIdx === 0 ? 1 + progress * 0.4 : 1.4 - progress * 0.4;

  if (done) return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
      <div style={{ fontSize: 13, color: "var(--safe)", fontWeight: 600, marginBottom: 8 }}>
        Exercise complete — {totalCycles} cycles done
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Notice how your body feels now compared to when you started.
      </div>
      <button onClick={onDone} style={{
        padding: "6px 14px", borderRadius: 8, border: "none",
        background: "var(--safe)", color: "#fff",
        fontSize: 12, fontWeight: 700, cursor: "pointer",
      }}>Done</button>
    </div>
  );

  return (
    <div style={{ textAlign: "center", padding: "8px 0", userSelect: "none" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        {type === "box" ? "Box breathing" : "4-7-8 breathing"} · Cycle {cycles + 1}/{totalCycles}
      </div>
      <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 10px" }}>
        <svg width="110" height="110" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx="55" cy="55" r={radius} fill="none" stroke="var(--border)" strokeWidth="4"/>
          <circle cx="55" cy="55" r={radius} fill="none"
            stroke={phase.color} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s", transform: "rotate(-90deg)", transformOrigin: "55px 55px" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: `${phase.color}22`,
            border: `2px solid ${phase.color}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${scale})`,
            transition: "transform 0.1s linear",
          }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: phase.color, opacity: 0.7 }}/>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: phase.color }}>{phase.label}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
        {Math.ceil((phases[phaseIdx].duration / 1000) * (1 - progress))}s
      </div>
    </div>
  );
}

// ── Grounding exercise (interactive 5-4-3-2-1) ────────────────────────────────
function GroundingExercise({ onDone }) {
  const STEPS = [
    { count: 5, sense: "see",   prompt: "Look around and name 5 things you can see right now." },
    { count: 4, sense: "touch", prompt: "Name 4 things you can physically touch or feel right now." },
    { count: 3, sense: "hear",  prompt: "Listen carefully. Name 3 things you can hear right now." },
    { count: 2, sense: "smell", prompt: "Name 2 things you can smell, or 2 scents you like." },
    { count: 1, sense: "taste", prompt: "Notice 1 thing you can taste, or your favourite taste." },
  ];
  const [step, setStep]    = useState(0);
  const [inputs, setInputs]= useState({});
  const [current, setCurrent]= useState("");

  function addItem() {
    if (!current.trim()) return;
    const prev = inputs[step] || [];
    const next = [...prev, current.trim()];
    setInputs(p => ({ ...p, [step]: next }));
    setCurrent("");
    if (next.length >= STEPS[step].count) {
      if (step < STEPS.length - 1) setTimeout(() => setStep(s => s + 1), 400);
      else setTimeout(() => onDone("Great work completing the grounding exercise. How do you feel now?"), 400);
    }
  }

  const s = STEPS[step];
  const filled = inputs[step]?.length || 0;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
        Step {step + 1}/5 · {s.count - filled} more to go
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>
        {s.prompt}
      </div>
      {(inputs[step] || []).map((item, i) => (
        <div key={i} style={{ fontSize: 12, color: "var(--safe)", marginBottom: 3 }}>✓ {item}</div>
      ))}
      {filled < s.count && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={current} onChange={e => setCurrent(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder={`Something you can ${s.sense}…`}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 8,
              border: "1px solid var(--inp-border)",
              background: "var(--inp-bg)", color: "var(--inp-text)",
              fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
            autoFocus
          />
          <button onClick={addItem} style={{
            padding: "7px 12px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Add</button>
        </div>
      )}
    </div>
  );
}

// ── Clinical context builder ───────────────────────────────────────────────────
function buildClinicalContext(riskScore, riskLevel, domainProfile, patientName) {
  if (!riskScore) return null;
  const firstName = (patientName || "").split(" ")[0];
  const ctx = { riskScore, riskLevel, firstName, dominantDomain: null, flags: [] };

  if (riskScore >= 76) ctx.flags.push("severe");
  if (riskScore >= 61) ctx.flags.push("high_risk");
  if (riskScore >= 41) ctx.flags.push("moderate");

  if (domainProfile) {
    const domains = Object.entries(domainProfile);
    const worst = domains.sort((a, b) => b[1] - a[1])[0];
    if (worst) ctx.dominantDomain = worst[0];
  }
  return ctx;
}

// ── Risk-adaptive response selector ──────────────────────────────────────────
function getRiskAdaptiveOpening(ctx, firstName) {
  if (!ctx) return null;
  if (ctx.flags.includes("severe")) {
    return `Hi ${firstName}. I can see from your recent assessment that things have been very difficult. I want you to know you're not alone in this, and I'm here to listen. Before we talk about anything else — how are you feeling right now, in this moment?`;
  }
  if (ctx.flags.includes("high_risk")) {
    return `Hi ${firstName}. Your assessment shows you've been going through a tough time lately. That takes courage to acknowledge. I'm here — what's been weighing on you most?`;
  }
  if (ctx.flags.includes("moderate")) {
    return `Hi ${firstName}. Your recent assessment shows some things have been challenging. I'm here to listen and share some techniques that might help. What's been on your mind?`;
  }
  return null;
}

function getDomainOpening(ctx, firstName) {
  if (!ctx?.dominantDomain) return null;
  const map = {
    depression: `${firstName}, your assessment suggests your mood has been lower than usual lately. I'd like to focus on that with you today. Can you tell me more about how you've been feeling day-to-day?`,
    anxiety:    `${firstName}, your assessment shows anxiety has been affecting you quite a bit. That tight, racing feeling is exhausting. What situations have been triggering it most for you?`,
    sleep:      `${firstName}, your assessment highlights sleep as a major concern right now. Poor sleep affects everything — mood, concentration, anxiety. Tell me more about what's been happening with your sleep.`,
    social:     `${firstName}, your assessment suggests you've been feeling quite disconnected from others. Loneliness can be really painful. How have your relationships been feeling lately?`,
    behavioural:`${firstName}, your assessment shows your daily routines — exercise, activity, appetite — have been affected. These are often early signs that something deeper is going on. What does a typical day look like for you right now?`,
  };
  return map[ctx.dominantDomain] || null;
}

// ── Response knowledge base ───────────────────────────────────────────────────
const KB = {
  crisis: `I'm really glad you reached out. What you're feeling matters, and you deserve support right now.\n\nPlease reach out to someone who can help immediately:\niCall (TISS): 9152987821\nVandrevala Foundation (24/7): 1860-2662-345\nNIMHANS Helpline: 080-46110007\n\nYou don't have to explain everything — just say you need to talk.`,

  anxiety: [
    `That anxious, racing feeling is genuinely exhausting — and it makes sense that it's affecting you.\n\nLet's try something right now. Box breathing directly activates your body's calm-down system — breathe in for 4, hold for 4, out for 4, hold for 4.\n\nWould you like me to guide you through it with a visual exercise?`,
    `Anxiety often works by catastrophising — jumping to the worst possible outcome before anything has happened.\n\nTry this: write down the thought that's scaring you most right now. Then ask — what is the most realistic thing that will actually happen? The realistic answer is almost always much calmer than the feared one.\n\nWhat's the thought that keeps coming up?`,
    `When anxiety feels overwhelming, the 5-4-3-2-1 grounding technique can pull you back into the present.\n\nWould you like to try it interactively? I'll walk you through each sense one at a time.`,
    `The STOPP technique can interrupt anxious spirals: Stop what you're doing. Take a breath. Observe your thought — what is it exactly? Pull back — is this a fact, or just a feeling? Practice what actually helps.\n\nWhat's the specific thought that's been hitting you hardest?`,
    `Your nervous system doesn't know the difference between a real threat and an imagined one — it responds the same way to both. That's why anxiety feels so physical.\n\nProgressive muscle relaxation can help reset it. Start by tensing your feet hard for 5 seconds, then completely releasing. Work upward through your body.\n\nShall we work through it together?`,
  ],

  depression: [
    `That heavy, low feeling is real and it's hard to carry. You don't have to explain it perfectly.\n\nOne of the most evidence-based places to start is behavioural activation — not a big task, just one tiny action. A 5-minute walk. Texting one person. Making tea. Small movement creates small momentum.\n\nWhat's one small thing you could do in the next 10 minutes?`,
    `When we're low, our inner critic gets very loud and very harsh.\n\nTry writing down the most self-critical thought you've had today. Then rewrite it as if you were talking to a friend who felt that way. We're almost always kinder to others than to ourselves.\n\nWhat's the harshest thing you've said to yourself recently?`,
    `Depression tells us nothing will help before we even try. That's a symptom — not the truth.\n\nA mood log can build real evidence against that thought. Just note: mood out of 10, what you were doing, one small thing that happened. Over a few weeks patterns emerge — and they're almost always more hopeful than the depression predicts.\n\nWhat would you rate your mood right now, out of 10?`,
    `Sometimes low mood is about losing connection with things that used to matter.\n\nThink of one activity — even something small — that used to bring a flicker of interest or calm. You don't need to enjoy it fully right now. Research shows action usually comes before motivation, not after.\n\nWhat comes to mind when you think about things you used to like?`,
    `A "positive data log" is a simple but powerful tool — a record of small moments that contradict thoughts like "I'm worthless" or "nothing ever gets better." Even tiny things count.\n\nWhat's one small thing from today or yesterday you could add to that list?`,
  ],

  sleep: [
    `Sleep problems affect everything downstream — mood, anxiety, concentration, how we handle stress.\n\nThe single most powerful technique is a consistent wake time — the same time every day including weekends. This anchors your circadian rhythm faster than anything else, including sleep medication.\n\nWhat time do you usually wake up? Is it consistent?`,
    `Racing thoughts at bedtime often respond well to scheduled worry time. Set aside 15 minutes in the afternoon specifically for worrying — write down every concern. When worries come at night, write them down and tell yourself: I'll deal with this at worry time tomorrow.\n\nWould that fit into your routine?`,
    `The 4-7-8 technique was specifically developed for sleep — breathe in for 4, hold for 7, out for 8. The long exhale activates your parasympathetic nervous system.\n\nWould you like me to guide you through it with a visual exercise?`,
    `If you're lying awake for more than 20 minutes, the best advice is counterintuitive — get up. Do something calm in low light. Return to bed only when genuinely sleepy.\n\nStaying in bed while awake teaches your brain that bed is a place for wakefulness. This is called stimulus control, and it's one of the most effective parts of CBT for insomnia.\n\nHave you tried this before?`,
  ],

  social: [
    `Feeling disconnected is one of the most painful feelings there is — and one of the most common, even though it rarely feels that way.\n\nEven the smallest connection can shift things: a brief message, being in the same space as people without having to perform or talk. You don't need to be "on."\n\nIs there one person — even someone you haven't spoken to in a while — who comes to mind?`,
    `Social anxiety often comes with a replay — going over an interaction afterwards, focusing on what might have gone wrong.\n\nTry catching yourself in that replay and asking: what actually happened, versus what I feared would happen? The gap between those two things is usually much smaller than anxiety suggests.\n\nDoes that replay pattern feel familiar?`,
    `Loneliness and low mood feed each other in a cycle. Research shows even very small doses of connection — a brief exchange, helping someone, just being present in a shared space — can interrupt the cycle.\n\nWhat's the smallest, least daunting connection you could imagine making today?`,
  ],

  grounding: [
    `Let's do the 5-4-3-2-1 grounding exercise together — I'll make it interactive so you can actually do it step by step.\n\nThis works by anchoring you in what's real and present right now, which interrupts anxious or overwhelming thoughts.`,
    `Box breathing is one of the fastest ways to calm your nervous system — it works within 3 cycles.\n\nLet me guide you through it with a visual.`,
    `Body scan: bring your attention slowly from the top of your head down to your feet. Just notice — don't try to change anything. Tension, heaviness, warmth, tingling.\n\nSometimes simply naming where you feel something is enough to soften it a little. Where do you notice it most in your body right now?`,
  ],

  positive: [
    `That's genuinely good to hear. What do you think made the difference?`,
    `Progress isn't always linear — noticing it matters. What feels different compared to before?`,
    `That's worth holding onto. Is there anything you want to build on from here?`,
  ],

  general: [
    `Thank you for sharing that. It takes something to put feelings into words.\n\nCan you tell me a bit more about what's been going on? I want to make sure I understand.`,
    `That sounds like a lot to carry. How long have you been feeling this way?`,
    `I hear you. Sometimes just having somewhere safe to put these feelings matters.\n\nWould it help more to talk through what's happening, or would you like to try a coping technique right now?`,
    `I'm here and I'm listening.\n\nWhat's been taking up the most space in your mind lately?`,
  ],
};

const _used = {};
function pickResponse(intent) {
  const pool = KB[intent];
  if (!Array.isArray(pool)) return pool;
  if (!_used[intent]) _used[intent] = [];
  const available = pool.map((_, i) => i).filter(i => !_used[intent].includes(i));
  const choices = available.length > 0 ? available : pool.map((_, i) => i);
  const idx = choices[Math.floor(Math.random() * choices.length)];
  _used[intent] = [..._used[intent].slice(-(pool.length - 1)), idx];
  return pool[idx];
}

const SUGGESTED = [
  "I've been really anxious lately",
  "I can't sleep properly",
  "I feel sad and don't know why",
  "Teach me a breathing exercise",
  "I feel very lonely",
  "How do I stop negative thoughts?",
  "I feel overwhelmed",
  "I don't want to talk to anyone",
];

// ── Sentiment mood indicator ───────────────────────────────────────────────────
function MoodIndicator({ history }) {
  if (history.length < 2) return null;
  const recent = history.slice(-3);
  const avg    = recent.reduce((a, b) => a + b, 0) / recent.length;
  const first  = history[0];
  const trend  = avg - first;

  const color = avg > 60 ? "var(--safe)" : avg > 40 ? "var(--warn)" : "var(--danger)";
  const label = avg > 60 ? "Positive" : avg > 40 ? "Neutral" : "Low";
  const arrow = trend > 5 ? "↑" : trend < -5 ? "↓" : "→";
  const arrowColor = trend > 5 ? "var(--safe)" : trend < -5 ? "var(--danger)" : "var(--muted)";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
      background: "var(--surface)", borderRadius: 8,
      border: "1px solid var(--border)", fontSize: 11,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: "var(--muted)" }}>Mood:</span>
      <span style={{ fontWeight: 700, color }}>{label}</span>
      <span style={{ color: arrowColor, fontWeight: 700 }}>{arrow}</span>
    </div>
  );
}

// ── Session summary generator ─────────────────────────────────────────────────
function generateSummary(messages, patientName, riskScore) {
  // ── Extract data safely ─────────────────────────────
  const userMessages = messages?.filter(m => m.role === "user") || [];
  const intents      = messages?.filter(m => m.intent).map(m => m.intent) || [];
  const sentiments   = messages?.filter(m => m.sentiment != null).map(m => m.sentiment) || [];

  // ── Topics ──────────────────────────────────────────
  const uniqueTopics = [...new Set(
    intents.filter(i => i !== "general" && i !== "positive")
  )];

  const topicLabels = {
    anxiety: "anxiety",
    depression: "low mood",
    sleep: "sleep difficulties",
    social: "social isolation",
    grounding: "grounding techniques",
    crisis: "crisis indicators"
  };

  // ── Sentiment Analysis ──────────────────────────────
  const avgSentiment = sentiments.length
    ? Math.round(sentiments.reduce((a, b) => a + b, 0) / sentiments.length)
    : null;

  const trendDir = sentiments.length > 2
    ? sentiments.at(-1) > sentiments[0]
      ? "improved"
      : sentiments.at(-1) < sentiments[0]
      ? "declined"
      : "remained stable"
    : null;

  // ── Build Raw Lines (NO logic here, only structure) ──
  const rawLines = [
    `Patient: ${patientName || "Unknown"}`,
    `ADMRI Risk Score: ${riskScore ?? "not assessed"}`,
    `Session length: ${userMessages.length} message${userMessages.length !== 1 ? "s" : ""}`,

    "",

    `Topics discussed: ${
      uniqueTopics.length
        ? uniqueTopics.map(t => topicLabels[t] || t).join(", ")
        : "general wellbeing"
    }`,

    avgSentiment !== null
      ? `Average emotional tone: ${avgSentiment}/100 (${
          avgSentiment > 60
            ? "positive"
            : avgSentiment > 40
            ? "neutral"
            : "distressed"
        })`
      : null,

    trendDir
      ? `Emotional trajectory: ${trendDir} during session`
      : null,

    "",

    "Key themes from patient messages:",

    ...userMessages.slice(0, 4).map(m =>
      `  · "${(m.text || "").slice(0, 80)}${m.text?.length > 80 ? "…" : ""}"`
    ),

    "",

    uniqueTopics.includes("crisis")
      ? "⚠️ CRISIS INDICATORS NOTED — follow up required"
      : null
  ];

  // ── Clean Output (THIS is where filtering happens) ──
  const cleanedLines = rawLines.filter(line =>
    typeof line === "string" && line.trim() !== ""
  );

  return cleanedLines.join("\n");
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ADMRIChatbot({ patientName, riskScore, riskLevel, domainProfile }) {
  const firstName = (patientName || "").split(" ")[0];
  const ctx       = buildClinicalContext(riskScore, riskLevel, domainProfile, patientName);

  const [modelReady, setModelReady] = useState(false);
  const [training,   setTraining]   = useState(false);

  useEffect(() => {
    if (intentClassifier.trained) { setModelReady(true); return; }
    setTraining(true);
    intentClassifier.train()
      .then(() => { setModelReady(true); setTraining(false); })
      .catch(() => setTraining(false));
  }, []);

  // Build context-aware welcome
  const welcome = (() => {
    const riskOpening   = getRiskAdaptiveOpening(ctx, firstName);
    const domainOpening = getDomainOpening(ctx, firstName);
    if (riskOpening)   return riskOpening;
    if (domainOpening) return domainOpening;
    return `Hi${firstName ? ` ${firstName}` : ""}! I'm your ADMRI Support Assistant — I'm here to listen and share evidence-based coping strategies.\n\nYou can tell me how you're feeling, ask about techniques for anxiety, sleep, or low mood, or just talk.\n\nEverything you share here is private.`;
  })();

  const [messages,    setMessages]    = useState([{ role:"bot", text:welcome, isCrisis:false }]);
  const [input,       setInput]       = useState("");
  const [typing,      setTyping]      = useState(false);
  const [exercise,    setExercise]    = useState(null); // { type: "box"|"4-7-8"|"grounding" }
  const [sentHistory, setSentHistory] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summary,     setSummary]     = useState("");
  const [summaryCopied, setSummaryCopied] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, exercise]);

  const send = useCallback((text) => {
    if (!text.trim() || typing) return;

    // Track user sentiment
    const sentScore = analyzeSentiment ? analyzeSentiment(text) : 50;
    setSentHistory(prev => [...prev, sentScore]);

    setMessages(prev => [...prev, { role:"user", text, sentiment: sentScore }]);
    setInput("");

    // Check if requesting an exercise
    const lower = text.toLowerCase();
    const wantsBreathing = lower.includes("breath") || lower.includes("breathing") || lower.includes("breathe");
    const wants478       = lower.includes("4-7-8") || lower.includes("478") || lower.includes("sleep") && lower.includes("breath");
    const wantsGrounding = lower.includes("ground") || lower.includes("5-4-3") || lower.includes("grounding");

    setTyping(true);
    const delay = 600 + Math.random() * 400;

    setTimeout(() => {
      const { intent } = intentClassifier.predict(text);
      const isCrisis   = intent === "crisis";

      // Build memory-aware context suffix
      const messageCount = messages.filter(m => m.role === "user").length;
      let response = pickResponse(intent);

      // Add conversation memory callbacks
      if (messageCount >= 3 && !isCrisis) {
        const prevTopics = messages.filter(m => m.intent && m.intent !== "general").map(m => m.intent);
        if (prevTopics.length > 0 && Math.random() > 0.5) {
          const topicLabels = { anxiety:"anxiety", depression:"how you've been feeling",
            sleep:"your sleep", social:"feeling connected to others" };
          const lastTopic = topicLabels[prevTopics[prevTopics.length - 1]];
          if (lastTopic && !response.includes("earlier")) {
            response = response + `\n\nYou mentioned ${lastTopic} earlier — has anything shifted since we started talking?`;
          }
        }
      }

      // Risk-adaptive tone for high/severe
      if (ctx?.flags.includes("high_risk") && intent === "general" && messageCount < 2) {
        response = `I can hear that things have been really hard. Given how your assessment has been going, I want to make sure we focus on what matters most to you right now.\n\n${response}`;
      }

      setMessages(prev => [...prev, { role:"bot", text:response, isCrisis, intent }]);
      setTyping(false);

      // Auto-trigger exercise if requested
      if (wantsGrounding) {
        setTimeout(() => setExercise({ type: "grounding" }), 300);
      } else if (wantsBreathing || intent === "grounding") {
        setTimeout(() => setExercise({ type: wants478 ? "4-7-8" : "box" }), 300);
      }
    }, delay);
  }, [typing, messages, ctx]);

  function handleExerciseDone(completionMessage) {
    setExercise(null);
    if (completionMessage) {
      setMessages(prev => [...prev, {
        role: "bot",
        text: completionMessage || "Well done completing the exercise. How do you feel now?",
        isCrisis: false,
        intent: "positive",
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: "bot",
        text: "Well done. Take a moment to notice how your body feels now. How are you doing?",
        isCrisis: false, intent: "positive",
      }]);
    }
  }

  function handleGenerateSummary() {
    const s = generateSummary(messages, patientName, riskScore);
    setSummary(s);
    setShowSummary(true);
  }

  function copySummary() {
    navigator.clipboard.writeText(summary).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    });
  }

  const riskColor = riskScore >= 70 ? "var(--danger)" : riskScore >= 40 ? "var(--warn)" : "var(--safe)";
  const userMessageCount = messages.filter(m => m.role === "user").length;

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      borderRadius:12, border:"1px solid var(--border)",
      background:"var(--card)", overflow:"hidden",
      fontFamily:"'DM Sans',sans-serif",
    }}>
      <style>{`@keyframes admriDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}`}</style>

      {/* Header */}
      <div style={{ padding:"11px 16px", background:"var(--surface)",
        borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
          background: training?"var(--warn)":modelReady?"var(--safe)":"var(--muted)" }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            ADMRI Support Chat
            {training&&<span style={{ padding:"2px 7px", borderRadius:8, fontSize:10, fontWeight:500,
              background:"color-mix(in srgb,var(--warn) 18%,transparent)", color:"var(--warn)" }}>training…</span>}
            {modelReady&&!training&&<span style={{ padding:"2px 7px", borderRadius:8, fontSize:10, fontWeight:500,
              background:"color-mix(in srgb,var(--safe) 18%,transparent)", color:"var(--safe)" }}>AI ready</span>}
          </div>
          <div style={{ fontSize:11, color:"var(--muted)", display:"flex", gap:6, flexWrap:"wrap", marginTop:2 }}>
            <span>CBT-grounded</span><span>·</span>
            <span>On-device</span><span>·</span>
            <span>Private</span>
            {riskScore!=null&&<><span>·</span>
              <span style={{ color:riskColor, fontWeight:600 }}>Risk: {riskScore}/100</span></>}
            {ctx?.dominantDomain&&<><span>·</span>
              <span style={{ color:"var(--muted)" }}>Focus: {ctx.dominantDomain}</span></>}
          </div>
        </div>
        {/* Mood indicator */}
        <MoodIndicator history={sentHistory} />
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 14px 8px",
        display:"flex", flexDirection:"column", gap:12,
        background:"var(--card)", minHeight:320, maxHeight:440 }}>
        {messages.map((msg,i)=>(
          <div key={i} style={{ display:"flex",
            flexDirection:msg.role==="user"?"row-reverse":"row",
            alignItems:"flex-end", gap:8 }}>
            {msg.role==="bot"&&<BotAvatar/>}
            <div style={{ maxWidth:"74%", padding:"10px 14px",
              borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
              background:msg.isCrisis
                ?"color-mix(in srgb,var(--danger) 12%,var(--card))"
                :msg.role==="user"?"var(--accent)":"var(--surface)",
              border:msg.isCrisis
                ?"1px solid color-mix(in srgb,var(--danger) 40%,transparent)"
                :msg.role==="user"?"none":"1px solid var(--border)",
              color:msg.isCrisis?"var(--danger)":msg.role==="user"?"#ffffff":"var(--text)",
              fontSize:13, lineHeight:1.65, wordBreak:"break-word" }}>
              {msg.text.split("\n").map((line,j)=>
                line.trim()
                  ?<p key={j} style={{ margin:0, marginBottom:2 }}>{line}</p>
                  :<div key={j} style={{ height:6 }}/>
              )}
            </div>
          </div>
        ))}

        {typing&&(
          <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
            <BotAvatar/>
            <div style={{ padding:"11px 14px", background:"var(--surface)",
              border:"1px solid var(--border)", borderRadius:"18px 18px 18px 4px" }}>
              {[0,1,2].map(j=>(
                <span key={j} style={{ display:"inline-block", width:7, height:7,
                  borderRadius:"50%", background:"var(--muted)", margin:"0 2px",
                  animation:`admriDot 1.2s ${j*0.2}s infinite ease-in-out` }}/>
              ))}
            </div>
          </div>
        )}

        {/* Inline exercise */}
        {exercise&&(
          <div style={{ padding:"14px 16px", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:12, margin:"4px 0" }}>
            {exercise.type==="grounding"
              ?<GroundingExercise onDone={handleExerciseDone}/>
              :<BreathingExercise type={exercise.type} onDone={()=>handleExerciseDone(null)}/>
            }
          </div>
        )}

        {/* Session summary panel */}
        {showSummary&&(
          <div style={{ padding:"14px 16px", background:"var(--surface)",
            border:"1px solid color-mix(in srgb,var(--accent) 40%,transparent)",
            borderRadius:12, margin:"4px 0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)" }}>Session Summary</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={copySummary} style={{ padding:"4px 10px", borderRadius:7,
                  border:"none", background:"var(--accent)", color:"#fff",
                  fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  {summaryCopied?"Copied!":"Copy"}
                </button>
                <button onClick={()=>setShowSummary(false)} style={{ padding:"4px 8px", borderRadius:7,
                  border:"none", background:"transparent", color:"var(--muted)",
                  fontSize:13, cursor:"pointer" }}>✕</button>
              </div>
            </div>
            <pre style={{ fontSize:12, color:"var(--text)", lineHeight:1.7,
              whiteSpace:"pre-wrap", margin:0, fontFamily:"'DM Sans',sans-serif" }}>
              {summary}
            </pre>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Suggested prompts */}
      {messages.length<=2&&(
        <div style={{ padding:"0 14px 10px", background:"var(--card)",
          display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
          {SUGGESTED.map((s,i)=>(
            <button key={i} onClick={()=>send(s)} style={{
              padding:"5px 12px", borderRadius:20, cursor:"pointer",
              background:"transparent", border:"1px solid var(--border)",
              color:"var(--muted)", fontSize:11,
              fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--muted)";}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ padding:"10px 12px 12px", background:"var(--surface)",
        borderTop:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0, flexDirection:"column" }}>

        {/* Session summary button — shows after 5+ messages */}
        {userMessageCount >= 5 && !showSummary && (
          <button onClick={handleGenerateSummary} style={{
            padding:"6px 14px", borderRadius:8,
            border:"1px solid color-mix(in srgb,var(--accent) 40%,transparent)",
            background:"color-mix(in srgb,var(--accent) 8%,transparent)",
            color:"var(--accent)", fontSize:11, fontWeight:700,
            cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
            alignSelf:"flex-start",
          }}>
            Generate session summary for clinical note
          </button>
        )}

        <div style={{ display:"flex", gap:8 }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}}
            rows={2} placeholder="Type how you're feeling, or ask for a coping technique…"
            style={{ flex:1, padding:"9px 13px", borderRadius:12,
              background:"var(--inp-bg)", border:"1px solid var(--inp-border)",
              color:"var(--inp-text)", fontSize:13, resize:"none", outline:"none",
              fontFamily:"'DM Sans',sans-serif", lineHeight:1.55, transition:"border-color 0.15s" }}
            onFocus={e=>e.target.style.borderColor="var(--inp-focus)"}
            onBlur={e =>e.target.style.borderColor="var(--inp-border)"}
          />
          <button onClick={()=>send(input)} disabled={!input.trim()||typing}
            style={{ width:42, borderRadius:12, border:"1px solid var(--border)",
              background:!input.trim()||typing?"var(--surface)":"var(--accent)",
              color:!input.trim()||typing?"var(--muted)":"#ffffff",
              fontWeight:700, fontSize:18,
              cursor:!input.trim()||typing?"not-allowed":"pointer",
              transition:"all 0.15s", alignSelf:"stretch",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            ↑
          </button>
        </div>
      </div>

      {/* Crisis footer */}
      <div style={{ padding:"6px 14px", flexShrink:0,
        background:"color-mix(in srgb,var(--danger) 8%,var(--surface))",
        borderTop:"1px solid color-mix(in srgb,var(--danger) 25%,transparent)",
        textAlign:"center", fontSize:11, color:"var(--muted)" }}>
        In crisis? iCall: <strong style={{ color:"var(--danger)" }}>9152987821</strong>
        {" "}· Vandrevala: <strong style={{ color:"var(--danger)" }}>1860–2662–345</strong>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
      background:"color-mix(in srgb,var(--accent) 18%,transparent)",
      border:"1px solid color-mix(in srgb,var(--accent) 35%,transparent)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:11, fontWeight:700, color:"var(--accent)" }}>
      AI
    </div>
  );
}
