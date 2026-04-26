import { useState } from "react";

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

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: "user", content: input };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: newHistory
        })
      });

      const data = await response.json();
      const reply = data.content[0].text;

      // Check if summary JSON is in the reply
      const jsonMatch = reply.match(/\{[\s\S]*"triage_priority"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const summary = JSON.parse(jsonMatch[0]);
          // POST to nurse dashboard (update URL when Shippy deploys)
          await fetch("http://localhost:4000/api/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...summary,
              transcript: newHistory
            })
          }).catch(() => console.log("Nurse dashboard not connected yet"));
          setDone(true);
        } catch (e) {
          console.log("JSON parse error", e);
        }
      }

      const visibleReply = reply.replace(/\{[\s\S]*"triage_priority"[\s\S]*\}/, "").trim();
      setMessages([...newHistory, { role: "assistant", content: visibleReply }]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div style={styles.doneScreen}>
        <div style={styles.doneCard}>
          <div style={styles.checkmark}>✓</div>
          <h2 style={styles.doneTitle}>Thank you</h2>
          <p style={styles.doneText}>A nurse will be with you shortly.</p>
          <p style={styles.doneText}>شكراً · Gracias · ধন্যবাদ · ਧੰਨਵਾਦ · धन्यवाद</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>🏥 ClearCare</h1>
        <p style={styles.subtitle}>Type in any language. We understand you.</p>
        <p style={styles.subtitle}>Escribe en cualquier idioma · যেকোনো ভাষায় লিখুন · ਕਿਸੇ ਵੀ ਭਾਸ਼ਾ ਵਿੱਚ ਲਿਖੋ</p>
      </div>

      <div style={styles.chatBox}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p>👋 Tell us what brings you in today.</p>
            <p style={{fontSize: "14px", color: "#888", marginTop: "8px"}}>
              Describe your symptoms below in your language.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? styles.userBubble : styles.assistantBubble}>
            {m.content}
          </div>
        ))}
        {loading && <div style={styles.assistantBubble}>...</div>}
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Type here in any language..."
          disabled={loading}
        />
        <button style={styles.button} onClick={sendMessage} disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </div>
      <p style={styles.footer}>Your information is being securely sent to your nurse.</p>
    </div>
  );
}

const styles = {
  container: { maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { textAlign: "center", marginBottom: "20px" },
  logo: { fontSize: "28px", margin: "0 0 8px 0", color: "#1a73e8" },
  subtitle: { fontSize: "13px", color: "#666", margin: "4px 0" },
  chatBox: { flex: 1, overflowY: "auto", padding: "16px", background: "#f8f9fa", borderRadius: "12px", minHeight: "400px", marginBottom: "16px" },
  emptyState: { textAlign: "center", color: "#666", marginTop: "80px", fontSize: "18px" },
  userBubble: { background: "#1a73e8", color: "white", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", marginBottom: "8px", marginLeft: "20%", textAlign: "right" },
  assistantBubble: { background: "white", color: "#333", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", marginBottom: "8px", marginRight: "20%", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  inputRow: { display: "flex", gap: "8px" },
  input: { flex: 1, padding: "12px 16px", borderRadius: "24px", border: "2px solid #1a73e8", fontSize: "16px", outline: "none" },
  button: { padding: "12px 24px", background: "#1a73e8", color: "white", border: "none", borderRadius: "24px", fontSize: "16px", cursor: "pointer" },
  footer: { textAlign: "center", fontSize: "12px", color: "#999", marginTop: "8px" },
  doneScreen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f7ff" },
  doneCard: { textAlign: "center", background: "white", padding: "48px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
  checkmark: { fontSize: "64px", color: "#34a853", marginBottom: "16px" },
  doneTitle: { fontSize: "32px", color: "#333", margin: "0 0 16px 0" },
  doneText: { color: "#666", fontSize: "16px", margin: "8px 0" }
};