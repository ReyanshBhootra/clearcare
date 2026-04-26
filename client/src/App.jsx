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
{"language":"","summary":{"chief_complaint":"","symptom_onset":"","severity_1_to_10":"","red_flags":[],"triage_priority":"Immediate or Urgent or Non-urgent","recommended_action":""},"escalation_alert":{"triggered":false,"reason":"","original_phrase":""}}`;

const ESCALATION_KEYWORDS = [
  "chest pain", "pecho", "brazo", "arm", "jaw", "mandíbula",
  "breathing", "respirar", "aire", "unconscious", "suicid",
  "bleeding", "sangr", "stroke", "derrame", "বুকে", "শ্বাস"
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
  const [escalationPhrase, setEscalationPhrase] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Check escalation on patient input
    if (detectEscalation(input)) {
      setEscalation(true);
      setEscalationPhrase(input);
      // Notify nurse dashboard immediately
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
      if (visibleReply) {
        setMessages([...newHistory, { role: "assistant", content: visibleReply }]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div style={styles.doneScreen}>
        <div style={styles.doneCard}>
          <div style={styles.checkCircle}>✓</div>
          <h2 style={styles.doneTitle}>Thank you</h2>
          <p style={styles.doneSubtitle}>A nurse will be with you shortly.</p>
          <p style={styles.doneLanguages}>شكراً · Gracias · ধন্যবাদ · ਧੰਨਵਾਦ · धन्यवाद</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Escalation Banner */}
      {escalation && (
        <div style={styles.escalationBanner}>
          <span style={styles.escalationIcon}>⚠️</span>
          <div>
            <div style={styles.escalationTitle}>NURSE ALERT SENT</div>
            <div style={styles.escalationSub}>Emergency detected — help is being notified</div>
          </div>
        </div>
      )}

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>🏥</span>
            <span style={styles.logoText}>ClearCare</span>
          </div>
          <p style={styles.tagline}>Type in any language. We understand you.</p>
          <div style={styles.langPills}>
            {["Español", "বাংলা", "ਪੰਜਾਬੀ", "हिंदी", "العربية", "中文"].map(l => (
              <span key={l} style={styles.pill}>{l}</span>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={styles.chatBox}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>👋</div>
              <p style={styles.emptyText}>Tell us what brings you in today.</p>
              <p style={styles.emptySubtext}>Describe your symptoms in your language below.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? styles.userRow : styles.assistantRow}>
              {m.role === "assistant" && <div style={styles.avatar}>🏥</div>}
              <div style={m.role === "user" ? styles.userBubble : styles.assistantBubble}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={styles.assistantRow}>
              <div style={styles.avatar}>🏥</div>
              <div style={styles.assistantBubble}>
                <span style={styles.typing}>●●●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={styles.inputWrapper}>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Type here in any language..."
              disabled={loading}
            />
            <button
              style={{...styles.sendBtn, opacity: loading ? 0.6 : 1}}
              onClick={sendMessage}
              disabled={loading}
            >
              {loading ? "..." : "→"}
            </button>
          </div>
          <p style={styles.footer}>🔒 Your information is securely sent to your nurse</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)", display: "flex", flexDirection: "column", alignItems: "center" },
  escalationBanner: { width: "100%", background: "linear-gradient(90deg, #ff3b30, #ff6b35)", color: "white", padding: "14px 24px", display: "flex", alignItems: "center", gap: "16px", animation: "pulse 1s infinite", boxShadow: "0 4px 20px rgba(255,59,48,0.4)", zIndex: 100 },
  escalationIcon: { fontSize: "28px" },
  escalationTitle: { fontWeight: "800", fontSize: "16px", letterSpacing: "1px" },
  escalationSub: { fontSize: "13px", opacity: 0.9 },
  container: { width: "100%", maxWidth: "620px", display: "flex", flexDirection: "column", minHeight: "100vh", padding: "0 16px" },
  header: { textAlign: "center", padding: "32px 0 20px" },
  logoRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" },
  logoIcon: { fontSize: "32px" },
  logoText: { fontSize: "32px", fontWeight: "800", background: "linear-gradient(135deg, #1a73e8, #0d47a1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  tagline: { color: "#555", fontSize: "15px", margin: "0 0 16px" },
  langPills: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" },
  pill: { background: "white", border: "1px solid #d0e4ff", color: "#1a73e8", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" },
  chatBox: { flex: 1, background: "white", borderRadius: "20px", padding: "20px", marginBottom: "16px", overflowY: "auto", minHeight: "400px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  emptyText: { fontSize: "20px", color: "#333", fontWeight: "600", margin: "0 0 8px" },
  emptySubtext: { fontSize: "14px", color: "#888" },
  userRow: { display: "flex", justifyContent: "flex-end", marginBottom: "12px" },
  assistantRow: { display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px" },
  avatar: { fontSize: "24px", flexShrink: 0 },
  userBubble: { background: "linear-gradient(135deg, #1a73e8, #1557b0)", color: "white", padding: "12px 18px", borderRadius: "20px 20px 4px 20px", maxWidth: "80%", fontSize: "15px", lineHeight: "1.5", boxShadow: "0 2px 8px rgba(26,115,232,0.3)" },
  assistantBubble: { background: "#f8f9fa", color: "#333", padding: "12px 18px", borderRadius: "20px 20px 20px 4px", maxWidth: "80%", fontSize: "15px", lineHeight: "1.5", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  typing: { letterSpacing: "4px", color: "#1a73e8", animation: "pulse 1s infinite" },
  inputWrapper: { paddingBottom: "24px" },
  inputRow: { display: "flex", gap: "10px", alignItems: "center" },
  input: { flex: 1, padding: "16px 20px", borderRadius: "30px", border: "2px solid #d0e4ff", fontSize: "15px", outline: "none", background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "border-color 0.2s" },
  sendBtn: { width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #1a73e8, #1557b0)", color: "white", border: "none", fontSize: "22px", cursor: "pointer", boxShadow: "0 4px 12px rgba(26,115,232,0.4)", display: "flex", alignItems: "center", justifyContent: "center" },
  footer: { textAlign: "center", fontSize: "12px", color: "#999", marginTop: "10px" },
  doneScreen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f7ff, #e8f4fd)" },
  doneCard: { textAlign: "center", background: "white", padding: "60px 48px", borderRadius: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.12)", maxWidth: "400px" },
  checkCircle: { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #34a853, #1e8e3e)", color: "white", fontSize: "40px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" },
  doneTitle: { fontSize: "36px", fontWeight: "800", color: "#1a1a1a", margin: "0 0 12px" },
  doneSubtitle: { color: "#555", fontSize: "16px", margin: "0 0 16px" },
  doneLanguages: { color: "#999", fontSize: "13px" }
};