import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:4000";

const PRIORITY_CONFIG = {
  Immediate: { color: "#ff2d2d", bg: "#1a0000", label: "🔴 IMMEDIATE" },
  Urgent: { color: "#ff8c00", bg: "#1a0800", label: "🟠 URGENT" },
  "Non-Urgent": { color: "#00c853", bg: "#001a08", label: "🟢 NON-URGENT" },
};

export default function App() {
  const [data, setData] = useState(null);
  const [alertTime, setAlertTime] = useState(null);
  const [flash, setFlash] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const prevEscalation = useRef(false);
  const lastKey = useRef(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/summary/latest`);
        if (!res.ok) return;
        const json = await res.json();
        const key = json.summary.chief_complaint;
        if (key === lastKey.current) return;
        lastKey.current = key;
        setData(json);
        if (json.escalation_alert?.triggered && !prevEscalation.current) {
          setAlertTime(new Date().toLocaleTimeString());
          triggerBeep();
          setFlash(true);
          setTimeout(() => setFlash(false), 3000);
        }
        prevEscalation.current = json.escalation_alert?.triggered;
      } catch (e) {}
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  function triggerBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1);
    } catch (e) {}
  }

  const priority = data?.summary?.triage_priority;
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG["Non-Urgent"];
  const escalation = data?.escalation_alert;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#0a0a0f", minHeight: "100vh", color: "#e8e8f0" }}>

      {escalation?.triggered && (
        <div style={{ background: flash ? "#ff0000" : "#8b0000", padding: "16px 32px", display: "flex", alignItems: "center", gap: "16px", borderBottom: "3px solid #ff2d2d", transition: "background 0.2s" }}>
          <span style={{ fontSize: "28px" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>⚠️ ESCALATION ALERT — {escalation.reason}</div>
            <div style={{ fontSize: "13px", opacity: 0.85, marginTop: "4px" }}>Patient said: "<em>{escalation.original_phrase}</em>"</div>
            {alertTime && <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "2px" }}>Alert triggered at {alertTime}</div>}
          </div>
        </div>
      )}

      <div style={{ background: "#111118", borderBottom: "1px solid #222235", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#7eb8ff" }}>ClearCare</span>
          <span style={{ color: "#555", fontSize: "13px" }}>Nurse Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {data?.language && (
            <span style={{ background: "#1a2035", border: "1px solid #2a3555", padding: "6px 14px", borderRadius: "20px", fontSize: "13px" }}>
              🌐 Patient Language: {data.language}
            </span>
          )}
          {priority && (
            <span style={{ background: pConfig.bg, border: `2px solid ${pConfig.color}`, color: pConfig.color, padding: "6px 18px", borderRadius: "20px", fontWeight: 700, fontSize: "13px" }}>
              {pConfig.label}
            </span>
          )}
        </div>
      </div>

      {!data ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: "16px", opacity: 0.4 }}>
          <div style={{ fontSize: "48px" }}>🏥</div>
          <div style={{ fontSize: "16px" }}>Waiting for patient intake...</div>
          <div style={{ fontSize: "13px", fontFamily: "monospace" }}>Polling for new patient data...</div>
        </div>
      ) : (
        <div style={{ padding: "32px", maxWidth: "1400px", margin: "0 auto" }}>

          <div style={{ background: "#111118", border: "1px solid #222235", borderRadius: "16px", padding: "28px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#556", fontWeight: 600, marginBottom: "20px", textTransform: "uppercase" }}>Triage Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase" }}>Chief Complaint</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>{data.summary.chief_complaint}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase" }}>Onset</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>{data.summary.symptom_onset}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase" }}>Severity</div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "#ff8c00" }}>{data.summary.severity_1_to_10}</span>
                  <span style={{ color: "#556", fontSize: "14px" }}>/10</span>
                  <div style={{ flex: 1, height: "8px", background: "#222235", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(parseInt(data.summary.severity_1_to_10) || 0) * 10}%`, background: parseInt(data.summary.severity_1_to_10) >= 8 ? "#ff2d2d" : parseInt(data.summary.severity_1_to_10) >= 5 ? "#ff8c00" : "#00c853", borderRadius: "4px" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#111118", border: "1px solid #222235", borderRadius: "16px", padding: "28px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#556", fontWeight: 600, marginBottom: "16px", textTransform: "uppercase" }}>Red Flags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.summary.red_flags.map((flag, i) => (
                <span key={i} style={{ background: "#2d0000", border: "1px solid #ff2d2d", color: "#ff8080", padding: "6px 14px", borderRadius: "20px", fontSize: "13px" }}>🚩 {flag}</span>
              ))}
            </div>
          </div>

          <div style={{ background: "#001a08", border: "1px solid #00c853", borderRadius: "16px", padding: "28px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#00c853", fontWeight: 600, marginBottom: "12px", textTransform: "uppercase" }}>Recommended Action</div>
            <div style={{ fontSize: "16px", color: "#e8e8f0" }}>{data.summary.recommended_action}</div>
          </div>

          <div style={{ background: "#111118", border: "1px solid #222235", borderRadius: "16px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#556", fontWeight: 600, textTransform: "uppercase" }}>
                Patient Transcript — <span style={{ color: "#7eb8ff" }}>{data.language}</span>
              </div>
              <button onClick={() => setTranscriptOpen(!transcriptOpen)} style={{ background: "none", border: "1px solid #333", color: "#888", padding: "4px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                {transcriptOpen ? "Collapse ▲" : "Expand ▼"}
              </button>
            </div>
            {transcriptOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
                {data.transcript.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "70%", background: msg.role === "user" ? "#1a2035" : "#1a1a2e", border: `1px solid ${msg.role === "user" ? "#2a3555" : "#2a2a4a"}`, borderRadius: "12px", padding: "10px 16px" }}>
                      <div style={{ fontSize: "10px", color: "#556", marginBottom: "4px" }}>{msg.role === "user" ? "👤 Patient" : "🤖 ClearCare AI"}</div>
                      <div style={{ fontSize: "14px", color: "#e8e8f0" }}>{msg.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}