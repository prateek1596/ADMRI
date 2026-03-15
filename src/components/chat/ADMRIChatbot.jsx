// src/components/chat/ADMRIChatbot.jsx
// ADMRI Support Chatbot — uses trained TF.js intent classifier from ClinicalDataset.js
// Falls back to regex if model not ready yet

import { useState, useRef, useEffect, useCallback } from "react";
import { intentClassifier } from "../../ml/ClinicalDataset";

// ── RESPONSES ─────────────────────────────────────────────────────────────────
const KB = {
  crisis: `I'm really glad you reached out. What you're feeling matters, and you deserve support right now.\n\nPlease reach out to someone who can help:\niCall (TISS): 9152987821\nVandrevala Foundation (24/7): 1860-2662-345\nNIMHANS Helpline: 080-46110007\n\nYou don't have to explain everything — just say you need to talk. I'm here with you too.`,

  anxiety: [
    `I can hear that anxiety is really getting to you. That racing, tense feeling is exhausting.\n\nTry box breathing right now — it directly activates your body's calm-down system. Breathe in for 4 counts, hold for 4, breathe out for 4, hold for 4. Do this 3 times.\n\nHow long have you been feeling this way?`,
    `Anxiety often tricks us into predicting the worst possible outcome. CBT calls this "catastrophising."\n\nTry writing down: what am I most worried will happen? Then ask — what is the most realistic thing that will actually happen? The realistic answer is almost always much calmer.\n\nWould you like to try that right now?`,
    `When anxiety feels overwhelming, grounding helps bring you back to the present moment.\n\nTry 5-4-3-2-1: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Take your time with each one.\n\nWhat's one thing you can see right now?`,
    `The STOPP technique can interrupt anxious spirals: Stop, Take a breath, Observe what your thought actually is, Pull back and ask if this is a fact or just a feeling, then Practice what helps.\n\nWhat's the thought that's been bothering you most?`,
    `Progressive muscle relaxation works well for physical anxiety. Tense your feet tightly for 5 seconds, then release completely. Move up through your legs, stomach, hands, shoulders, and face.\n\nThe contrast between tension and release teaches your body what calm actually feels like. Want to try it?`,
  ],

  depression: [
    `I hear you — that heavy, low feeling is really hard to carry.\n\nOne of the most evidence-based techniques is behavioural activation — starting very small. Not a big task, just one tiny action: a 5-minute walk, texting one person, making a cup of tea. Small actions create small momentum.\n\nWhat's one tiny thing you could do in the next 10 minutes?`,
    `When we're feeling low, our inner voice becomes very harsh and self-critical.\n\nTry this: write down your harshest self-critical thought. Then rewrite it as if you were speaking kindly to a close friend who felt this way. We're usually much gentler with others than with ourselves.\n\nWhat's one thought you could try rewriting?`,
    `Depression often tells us that nothing will help before we even try. That's a symptom, not a fact.\n\nTry a simple mood log today: write your mood out of 10, what you were doing, and one small thing that happened. Over time this builds real evidence against the thought that nothing ever gets better.\n\nHow does your mood feel right now, out of 10?`,
    `Sometimes low mood is linked to losing connection with things that used to matter.\n\nThink of one activity that used to bring even a small spark of interest or calm. You don't have to fully enjoy it right now — just doing it is enough. Research shows action often comes before motivation, not after.\n\nWhat comes to mind?`,
    `One powerful CBT technique is keeping a "positive data log" — a small record of moments that contradict the thought "I'm worthless" or "nothing good happens." Even tiny things count.\n\nWhat's one small moment from today or yesterday you could add?`,
  ],

  sleep: [
    `Sleep problems affect everything — mood, focus, how we handle stress.\n\nThe single most powerful sleep technique is consistent wake time: try waking at the same time every day, including weekends. This anchors your body clock faster than anything else.\n\nWhat time do you usually wake up?`,
    `Scheduled worry time is really effective for racing thoughts at bedtime. Set aside 15-20 minutes in the afternoon as your only allowed worry time. When worries come at night, write them down and say: I'll deal with this at worry time.\n\nWould that fit your routine?`,
    `The 4-7-8 breathing technique was designed for sleep: breathe in for 4 counts, hold for 7, breathe out slowly for 8. The long exhale activates your body's natural sleep switch.\n\nShall we try it together right now?`,
    `If you can't fall asleep after 20 minutes, the best advice is to get up and do something calm in dim light — read, gentle stretching — then return to bed only when sleepy.\n\nThis prevents the bed becoming mentally associated with wakefulness. Have you tried this before?`,
  ],

  social: [
    `Feeling disconnected is genuinely painful — and it's more common than it seems, especially at your age.\n\nEven the smallest social connection helps: a brief message to someone, a shared joke, just being near other people without having to perform. You don't need to be "on."\n\nIs there one person you feel even slightly comfortable around?`,
    `Social anxiety often involves a mental "replay" after interactions — going over what might have gone wrong.\n\nTry to catch yourself doing this and ask: what actually happened versus what I feared would happen? The gap between those two things is usually much smaller than anxiety suggests.\n\nDoes this replay pattern feel familiar?`,
    `Loneliness and low mood feed each other. Research shows even small doses of connection — a brief conversation, helping someone, just being in a shared space — can shift the cycle.\n\nWhat's the smallest connection you could imagine making today?`,
  ],

  grounding: [
    `Let's do a quick grounding exercise together right now.\n\n5-4-3-2-1: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Take your time with each one.\n\nStart with 5 things you can see — what do you notice?`,
    `Box breathing is one of the fastest ways to calm your nervous system.\n\nBreathe in slowly for 4 counts. Hold for 4. Breathe out for 4. Hold for 4. Repeat 3 times.\n\nTry it now and tell me how you feel after.`,
    `Body scan: close your eyes and slowly move your attention from the top of your head down to your feet. Notice any tension without trying to change it. Just observe.\n\nSometimes just naming tension is enough to release it a little. Where do you feel it most in your body?`,
  ],

  positive: [
    `That's really good to hear. How did it make you feel?`,
    `It's great that you're reflecting on this — self-awareness is one of the most powerful tools for wellbeing. What do you think made the difference?`,
    `Progress isn't always linear, but noticing it matters. You're paying attention, and that counts. Is there anything you'd like to build on from here?`,
  ],

  general: [
    `Thank you for sharing that with me. You're not alone in feeling this way.\n\nCan you tell me a bit more about what's been going on? The more I understand, the better I can help.`,
    `That sounds like a lot to carry. How long have you been feeling this way?`,
    `I hear you. Sometimes it helps just to have somewhere safe to put these feelings.\n\nWould it be more helpful to talk through what's happening, or would you like to try a quick coping technique right now?`,
    `It takes real courage to put feelings into words. I'm glad you did.\n\nWhat's the part that's been feeling hardest lately?`,
    `I'm here and I'm listening. You don't have to have everything figured out to talk.\n\nWhat's on your mind most right now?`,
  ],
};

const _used = {};
function pickResponse(intent) {
  const pool = KB[intent];
  if (!Array.isArray(pool)) return pool;
  if (!_used[intent]) _used[intent] = [];
  const available = pool.map((_,i) => i).filter(i => !_used[intent].includes(i));
  const choices = available.length > 0 ? available : pool.map((_,i) => i);
  const idx = choices[Math.floor(Math.random() * choices.length)];
  _used[intent] = [..._used[intent].slice(-(pool.length-1)), idx];
  return pool[idx];
}

function getReply(text, confidence = null) {
  const { intent } = intentClassifier.predict(text);
  const body = pickResponse(intent);
  return { text: body, isCrisis: intent === "crisis", intent, confidence };
}

// ── SUGGESTED PROMPTS ─────────────────────────────────────────────────────────
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

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ADMRIChatbot({ patientName, riskScore, riskLevel }) {
  const firstName = patientName ? patientName.split(" ")[0] : "";
  const [modelReady, setModelReady] = useState(false);
  const [training,   setTraining]   = useState(false);

  // Train intent classifier on mount
  useEffect(() => {
    if (intentClassifier.trained) { setModelReady(true); return; }
    setTraining(true);
    intentClassifier.train().then(() => {
      setModelReady(true);
      setTraining(false);
    }).catch(() => setTraining(false));
  }, []);

  const welcome = `Hi${firstName ? ` ${firstName}` : ""}! I'm your ADMRI Support Assistant — I'm here to listen and share evidence-based coping strategies.\n\nYou can tell me how you're feeling, ask about techniques for anxiety, sleep, or low mood, or just talk.\n\nEverything you share here is private.`;

  const [messages, setMessages] = useState([
    { role: "bot", text: welcome, isCrisis: false },
  ]);
  const [input,  setInput]  = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = useCallback((text) => {
    if (!text.trim() || typing) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    const delay = 650 + Math.random() * 450;
    setTimeout(() => {
      const { text: reply, isCrisis, intent } = getReply(text);
      setMessages(prev => [...prev, { role: "bot", text: reply, isCrisis, intent }]);
      setTyping(false);
    }, delay);
  }, [typing]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const riskColor = riskScore >= 70 ? T.danger : riskScore >= 40 ? T.warn : T.safe;

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:500,
      borderRadius:12, border:`1px solid ${T.border}`,
      background:T.chatBg, overflow:"hidden",
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <style>{`
        @keyframes admriDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
      `}</style>

      {/* Header */}
      <div style={{
        padding:"11px 16px", background:T.cardBg,
        borderBottom:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0,
      }}>
        <div style={{
          width:9, height:9, borderRadius:"50%", flexShrink:0,
          background: training ? T.warn : modelReady ? T.safe : T.muted,
          boxShadow:`0 0 0 3px ${(training ? T.warn : T.safe)}22`,
        }}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:T.text}}>
            ADMRI Support Chat
            {training && (
              <span style={{marginLeft:8,padding:"2px 7px",borderRadius:8,
                background:`${T.warn}22`,color:T.warn,fontSize:10,fontWeight:500}}>
                training intent model…
              </span>
            )}
            {modelReady && !training && (
              <span style={{marginLeft:8,padding:"2px 7px",borderRadius:8,
                background:`${T.safe}18`,color:T.safe,fontSize:10,fontWeight:500}}>
                AI ready
              </span>
            )}
          </div>
          <div style={{fontSize:11,color:T.muted,display:"flex",gap:6,flexWrap:"wrap"}}>
            <span>CBT-grounded</span><span>·</span>
            <span>On-device</span><span>·</span>
            <span>Private</span>
            {riskScore != null && (
              <><span>·</span>
              <span style={{color:riskColor,fontWeight:600}}>Risk: {riskScore}/100</span></>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={{
        flex:1, overflowY:"auto", padding:"16px 14px 8px",
        display:"flex", flexDirection:"column", gap:12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display:"flex",
            flexDirection: msg.role==="user" ? "row-reverse" : "row",
            alignItems:"flex-end", gap:8,
          }}>
            {msg.role === "bot" && <BotAvatar />}
            <div style={{
              maxWidth:"72%", padding:"10px 14px",
              borderRadius: msg.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.isCrisis ? "#2D0D0D"
                : msg.role==="user" ? T.accent : T.botBubble,
              border: msg.isCrisis ? `1px solid ${T.danger}55`
                : msg.role==="user" ? "none" : `1px solid ${T.border}`,
              color: msg.isCrisis ? T.danger : msg.role==="user" ? "#fff" : T.text,
              fontSize:13, lineHeight:1.65, wordBreak:"break-word",
            }}>
              {msg.text.split("\n").map((line,j) =>
                line.trim()
                  ? <p key={j} style={{margin:0,marginBottom:2}}>{line}</p>
                  : <div key={j} style={{height:6}}/>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
            <BotAvatar />
            <div style={{
              padding:"11px 14px",
              background:T.botBubble,
              border:`1px solid ${T.border}`,
              borderRadius:"18px 18px 18px 4px",
            }}>
              {[0,1,2].map(j=>(
                <span key={j} style={{
                  display:"inline-block",width:7,height:7,borderRadius:"50%",
                  background:T.muted,margin:"0 2px",
                  animation:`admriDot 1.2s ${j*0.2}s infinite ease-in-out`,
                }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggested chips */}
      {messages.length <= 2 && (
        <div style={{padding:"0 14px 10px",display:"flex",flexWrap:"wrap",gap:6,flexShrink:0}}>
          {SUGGESTED.map((s,i)=>(
            <button key={i} onClick={()=>send(s)} style={{
              padding:"5px 12px",borderRadius:20,cursor:"pointer",
              background:"transparent",border:`1px solid ${T.border}`,
              color:T.muted,fontSize:11,fontFamily:"inherit",transition:"all 0.15s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding:"10px 12px 12px",background:T.cardBg,
        borderTop:`1px solid ${T.border}`,display:"flex",gap:8,flexShrink:0,
      }}>
        <textarea
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="Type how you're feeling, or ask for a coping technique…"
          style={{
            flex:1,padding:"9px 13px",borderRadius:12,
            background:T.inputBg,border:`1px solid ${T.border}`,
            color:T.text,fontSize:13,resize:"none",outline:"none",
            fontFamily:"inherit",lineHeight:1.55,transition:"border-color 0.15s",
          }}
          onFocus={e=>e.target.style.borderColor=T.accent}
          onBlur={e=>e.target.style.borderColor=T.border}
        />
        <button
          onClick={()=>send(input)}
          disabled={!input.trim()||typing}
          style={{
            width:42,borderRadius:12,border:"none",
            background:!input.trim()||typing?T.surface:T.accent,
            color:!input.trim()||typing?T.muted:"#fff",
            fontWeight:700,fontSize:18,
            cursor:!input.trim()||typing?"not-allowed":"pointer",
            transition:"all 0.15s",alignSelf:"stretch",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}
        >↑</button>
      </div>

      {/* Crisis footer */}
      <div style={{
        padding:"6px 14px",background:"#1A0D0D",
        borderTop:`1px solid ${T.danger}33`,
        textAlign:"center",fontSize:11,color:"#6B4040",flexShrink:0,
      }}>
        In crisis? iCall: <strong style={{color:T.danger}}>9152987821</strong>
        {" "}· Vandrevala: <strong style={{color:T.danger}}>1860-2662-345</strong>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div style={{
      width:30,height:30,borderRadius:"50%",flexShrink:0,
      background:`${T.accent}22`,border:`1px solid ${T.accent}44`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:11,fontWeight:700,color:T.accent,
      fontFamily:"'DM Sans', sans-serif",
    }}>AI</div>
  );
}

const T = {
  accent:"#58A6FF", safe:"#3FB950", warn:"#E3B341", danger:"#F85149",
  muted:"#8B949E", text:"#E6EDF3", border:"#21262D",
  chatBg:"#0D1117", cardBg:"#161B22", botBubble:"#1C2128",
  surface:"#21262D", inputBg:"#0D1117",
};
