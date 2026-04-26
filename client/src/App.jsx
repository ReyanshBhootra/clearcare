import { useState, useEffect, useRef } from "react";

const SYSTEM_PROMPT = `You are ClearCare, a compassionate medical triage assistant working in an emergency clinic. Your job is to help patients who do not speak English describe their symptoms clearly so a nurse can help them faster.

RULES:
- Detect the patient's language from their first message and respond ONLY in that language for the entire conversation
- Never switch languages mid-conversation
- Never diagnose. Never suggest medications. Never alarm the patient.
- Ask one question at a time. Keep questions simple and human.
- You must collect: chief complaint, onset time, severity (1-10), location on body, any relevant history
- After 5-6 exchanges, when you have enough information, tell the patient help is coming, then output the JSON block below on a new line

ESCALATION: If the patient describes any of these, set escalation triggered to true:
- Chest pain + arm/jaw pain
- Difficulty breathing
- Loss of consciousness
- Suicidal thoughts
- Severe bleeding
- Stroke symptoms

When conversation is complete output this exact JSON in English:
{"language":"","transcript":[],"summary":{"chief_complaint":"","symptom_onset":"","severity_1_to_10":"","red_flags":[],"triage_priority":"Immediate or Urgent or Non-Urgent","recommended_action":""},"escalation_alert":{"triggered":false,"reason":"","original_phrase":""}}`;

const ESCALATION_KEYWORDS = [
  "chest pain","pecho","brazo","arm","jaw","mandíbula",
  "breathing","respirar","aire","unconscious","suicid",
  "bleeding","sangr","stroke","derrame","বুকে","শ্বাস"
];

function detectEscalation(text) {
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.some(k => lower.includes(k));
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [escalation, setEscalation] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const startVoice = () => {
    if (listening) {
      mediaRecorderRef.current?.stop();
      setListening(false);
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setListening(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();

        try {
          const res = await fetch("http://localhost:3001/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "audio/webm" },
            body: arrayBuffer
          });
          const data = await res.json();
          if (data.transcript) {
            setInput(data.transcript);
          }
        } catch (err) {
          console.error("Transcription error", err);
        }
      };

      mediaRecorder.start();
      setListening(true);

      // Auto stop after 6 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
      }, 6000);
    }).catch(() => {
      alert("Microphone access denied. Please allow mic access in Chrome.");
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (detectEscalation(input)) {
      setEscalation(true);
      fetch("http://localhost:4000/api/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: input, timestamp: new Date().toISOString() })
      }).catch(() => {});
    }
    const userMessage = { role: "user", content: input };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: newHistory
        })
      });
      const data = await response.json();
      const reply = data.content[0].text;
      const jsonMatch = reply.match(/\{[\s\S]*"triage_priority"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const summary = JSON.parse(jsonMatch[0]);
          await fetch("http://localhost:4000/api/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...summary, transcript: newHistory })
          }).catch(() => {});
          setDone(true);
        } catch (e) {}
      }
      const visibleReply = reply.replace(/\{[\s\S]*"triage_priority"[\s\S]*\}/, "").trim();
      if (visibleReply) setMessages([...newHistory, { role: "assistant", content: visibleReply }]);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (done) return (
    <div style={s.donePage}>
      <style>{animations}</style>
      <div style={s.doneCard}>
        <div style={s.doneCheck}>✓</div>
        <h2 style={s.doneTitle}>You're all set</h2>
        <p style={s.doneSub}>A nurse will be with you shortly.</p>
        <p style={s.doneLangs}>شكراً · Gracias · ধন্যবাদ · ਧੰਨਵਾਦ · धन्यवाद · 谢谢</p>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <style>{animations}</style>

      {/* Mesh gradient background blobs */}
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      {/* Escalation banner */}
      {escalation && (
        <div style={s.alertBanner}>
          <span style={{fontSize:"20px"}}>🚨</span>
          <div>
            <div style={s.alertTitle}>EMERGENCY ALERT SENT TO NURSE</div>
            <div style={s.alertSub}>Critical symptoms detected — help is being notified immediately</div>
          </div>
        </div>
      )}

      <div style={s.shell}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logoWrap}>
            <img src="/logo.jpg" style={{width:"42px", height:"42px", borderRadius:"10px"}} />
            <span style={s.logoText}>ClearCare</span>
            <span style={s.logoBadge}>AI Triage</span>
          </div>
          <p style={s.tagline}>Describe your symptoms in any language.</p>
          <div style={s.pills}>
            {["Español","বাংলা","ਪੰਜਾਬੀ","हिंदी","العربية","中文","Português"].map(l => (
              <span key={l} style={s.pill}>{l}</span>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div style={s.chat}>
          {messages.length === 0 ? (
            <div style={s.empty}>
              <div style={s.emptyPulse}>
                <span style={{fontSize:"32px"}}>🏥</span>
              </div>
              <p style={s.emptyTitle}>Tell us what brings you in today</p>
              <p style={s.emptySub}>Type or speak in your language — we understand you</p>
            </div>
          ) : messages.map((m, i) => (
            <div key={i} style={m.role==="user" ? s.userRow : s.botRow}>
              {m.role==="assistant" && <div style={s.botAvatar}>+</div>}
              <div style={m.role==="user" ? s.userBubble : s.botBubble}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={s.botRow}>
              <div style={s.botAvatar}>+</div>
              <div style={s.botBubble}>
                <span style={s.dots}>●&nbsp;●&nbsp;●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={s.inputArea}>
          <div style={s.inputBar}>
            <button
              style={{...s.micBtn, background: listening ? "#ff3b30" : "rgba(255,255,255,0.1)"}}
              onClick={startVoice}
              title="Speak in any language"
            >
              {listening ? "🔴" : "🎤"}
            </button>
            <input
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && sendMessage()}
              placeholder={listening ? "Listening..." : "Type here in any language..."}
              disabled={loading}
            />
            <button
              style={{...s.sendBtn, opacity: (!input.trim()||loading) ? 0.5 : 1}}
              onClick={sendMessage}
              disabled={!input.trim()||loading}
            >
              ↑
            </button>
          </div>
          <p style={s.footerText}>🔒 Securely sent to your nurse · Powered by Claude AI</p>
        </div>
      </div>
    </div>
  );
}

const animations = `
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes blobMove { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.05); } }
  @keyframes alertFlash { 0%,100% { opacity:1; } 50% { opacity:0.85; } }
`;

const s = {
  page: { minHeight:"100vh", background:"#0a0a0f", display:"flex", flexDirection:"column", alignItems:"center", position:"relative", overflow:"hidden", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  blob1: { position:"fixed", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"blobMove 8s ease-in-out infinite", pointerEvents:"none" },
  blob2: { position:"fixed", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", bottom:"-50px", right:"-50px", animation:"blobMove 10s ease-in-out infinite reverse", pointerEvents:"none" },
  blob3: { position:"fixed", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)", top:"50%", left:"50%", transform:"translate(-50%,-50%)", animation:"blobMove 12s ease-in-out infinite", pointerEvents:"none" },
  alertBanner: { width:"100%", background:"linear-gradient(90deg,#ff3b30,#ff6b35)", color:"white", padding:"14px 28px", display:"flex", alignItems:"center", gap:"16px", zIndex:100, animation:"alertFlash 0.8s infinite" },
  alertTitle: { fontWeight:"800", fontSize:"15px", letterSpacing:"0.5px" },
  alertSub: { fontSize:"12px", opacity:0.9, marginTop:"2px" },
  shell: { width:"100%", maxWidth:"640px", display:"flex", flexDirection:"column", minHeight:"100vh", padding:"0 20px", position:"relative", zIndex:1 },
  header: { padding:"40px 0 24px", textAlign:"center" },
  logoWrap: { display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", marginBottom:"12px" },
  logoIcon: { width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg,#6366f1,#3b82f6)", color:"white", fontWeight:"900", fontSize:"20px", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 20px rgba(99,102,241,0.4)" },
  logoText: { fontSize:"26px", fontWeight:"800", color:"white", letterSpacing:"-0.5px" },
  logoBadge: { background:"rgba(99,102,241,0.2)", border:"1px solid rgba(99,102,241,0.4)", color:"#a5b4fc", padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600", letterSpacing:"0.5px" },
  tagline: { color:"rgba(255,255,255,0.5)", fontSize:"14px", margin:"0 0 16px" },
  pills: { display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px" },
  pill: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", padding:"4px 12px", borderRadius:"20px", fontSize:"12px" },
  chat: { flex:1, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"20px", padding:"24px", marginBottom:"16px", overflowY:"auto", minHeight:"400px", backdropFilter:"blur(20px)" },
  empty: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"60px 20px", textAlign:"center" },
  emptyPulse: { width:"72px", height:"72px", borderRadius:"50%", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"20px", animation:"pulse 2s infinite" },
  emptyTitle: { fontSize:"20px", fontWeight:"700", color:"rgba(255,255,255,0.9)", margin:"0 0 8px" },
  emptySub: { fontSize:"14px", color:"rgba(255,255,255,0.4)", maxWidth:"280px" },
  userRow: { display:"flex", justifyContent:"flex-end", marginBottom:"12px", animation:"fadeIn 0.3s ease" },
  botRow: { display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"12px", animation:"fadeIn 0.3s ease" },
  botAvatar: { width:"32px", height:"32px", borderRadius:"10px", background:"linear-gradient(135deg,#6366f1,#3b82f6)", color:"white", fontWeight:"900", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  userBubble: { background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"white", padding:"12px 18px", borderRadius:"18px 18px 4px 18px", maxWidth:"78%", fontSize:"15px", lineHeight:"1.6", boxShadow:"0 4px 16px rgba(99,102,241,0.3)" },
  botBubble: { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.9)", padding:"12px 18px", borderRadius:"18px 18px 18px 4px", maxWidth:"78%", fontSize:"15px", lineHeight:"1.6" },
  dots: { animation:"pulse 1s infinite", color:"#6366f1", letterSpacing:"3px" },
  inputArea: { paddingBottom:"28px" },
  inputBar: { display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"16px", padding:"8px 8px 8px 16px", backdropFilter:"blur(20px)" },
  micBtn: { width:"40px", height:"40px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"18px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" },
  input: { flex:1, background:"transparent", border:"none", outline:"none", color:"white", fontSize:"15px", padding:"6px 0" },
  sendBtn: { width:"40px", height:"40px", borderRadius:"10px", background:"linear-gradient(135deg,#6366f1,#4f46e5)", border:"none", color:"white", fontSize:"20px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 4px 12px rgba(99,102,241,0.4)", transition:"opacity 0.2s" },
  footerText: { textAlign:"center", fontSize:"11px", color:"rgba(255,255,255,0.25)", marginTop:"10px" },
  donePage: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0f" },
  doneCard: { textAlign:"center", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", padding:"60px 48px", borderRadius:"24px", backdropFilter:"blur(20px)" },
  doneCheck: { width:"80px", height:"80px", borderRadius:"50%", background:"linear-gradient(135deg,#10b981,#059669)", color:"white", fontSize:"36px", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", boxShadow:"0 0 40px rgba(16,185,129,0.3)" },
  doneTitle: { fontSize:"32px", fontWeight:"800", color:"white", margin:"0 0 12px" },
  doneSub: { color:"rgba(255,255,255,0.5)", fontSize:"16px", margin:"0 0 16px" },
  doneLangs: { color:"rgba(255,255,255,0.25)", fontSize:"13px" },
};