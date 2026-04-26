// ============================================================
// App.js — ClearCare Nurse Dashboard (v2)
// Polls backend every 2s for patient data from Reyansh's app
// Nurse can switch UI language via dropdown
// ============================================================

import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:4000";

const NURSE_LANGS = {
  English: {
    label: "English", flag: "🇺🇸",
    waiting: "Waiting for patient intake...",
    polling: "Polling for new patient data...",
    triageSummary: "Triage Summary",
    chiefComplaint: "Chief Complaint",
    onset: "Onset", severity: "Severity",
    redFlags: "Red Flags",
    recommendedAction: "Recommended Action",
    transcript: "Patient Transcript",
    collapse: "Collapse ▲", expand: "Expand ▼",
    escalationPrefix: "⚠️ ESCALATION ALERT",
    patientSaid: "Patient said",
    alertAt: "Alert triggered at",
    nurseDashboard: "Nurse Dashboard",
    detectedLanguage: "Patient Language",
    aiLabel: "🤖 ClearCare AI", patientLabel: "👤 Patient",
    selectLang: "Nurse Language",
  },
  Spanish: {
    label: "Español", flag: "🇪🇸",
    waiting: "Esperando al paciente...",
    polling: "Buscando datos del paciente...",
    triageSummary: "Resumen de Triaje",
    chiefComplaint: "Queja Principal",
    onset: "Inicio", severity: "Gravedad",
    redFlags: "Alertas Rojas",
    recommendedAction: "Acción Recomendada",
    transcript: "Transcripción del Paciente",
    collapse: "Colapsar ▲", expand: "Expandir ▼",
    escalationPrefix: "⚠️ ALERTA DE ESCALADA",
    patientSaid: "El paciente dijo",
    alertAt: "Alerta activada a las",
    nurseDashboard: "Panel de Enfermería",
    detectedLanguage: "Idioma del Paciente",
    aiLabel: "🤖 ClearCare AI", patientLabel: "👤 Paciente",
    selectLang: "Idioma Enfermera",
  },
  Portuguese: {
    label: "Português", flag: "🇧🇷",
    waiting: "Aguardando paciente...",
    polling: "Verificando dados do paciente...",
    triageSummary: "Resumo de Triagem",
    chiefComplaint: "Queixa Principal",
    onset: "Início", severity: "Gravidade",
    redFlags: "Alertas Vermelhos",
    recommendedAction: "Ação Recomendada",
    transcript: "Transcrição do Paciente",
    collapse: "Recolher ▲", expand: "Expandir ▼",
    escalationPrefix: "⚠️ ALERTA DE ESCALADA",
    patientSaid: "Paciente disse",
    alertAt: "Alerta disparado às",
    nurseDashboard: "Painel de Enfermagem",
    detectedLanguage: "Idioma do Paciente",
    aiLabel: "🤖 ClearCare AI", patientLabel: "👤 Paciente",
    selectLang: "Idioma da Enfermeira",
  },
  Hindi: {
    label: "हिन्दी", flag: "🇮🇳",
    waiting: "मरीज़ की प्रतीक्षा...",
    polling: "नया डेटा खोज रहे हैं...",
    triageSummary: "ट्रायज सारांश",
    chiefComplaint: "मुख्य शिकायत",
    onset: "शुरुआत", severity: "गंभीरता",
    redFlags: "रेड फ्लैग",
    recommendedAction: "अनुशंसित कार्रवाई",
    transcript: "मरीज़ की बातचीत",
    collapse: "बंद करें ▲", expand: "खोलें ▼",
    escalationPrefix: "⚠️ आपातकालीन अलर्ट",
    patientSaid: "मरीज़ ने कहा",
    alertAt: "अलर्ट समय",
    nurseDashboard: "नर्स डैशबोर्ड",
    detectedLanguage: "मरीज़ की भाषा",
    aiLabel: "🤖 ClearCare AI", patientLabel: "👤 मरीज़",
    selectLang: "नर्स की भाषा",
  },
};

const PRIORITY_CONFIG = {
  Immediate:    { color: "#ff2d2d", bg: "#1a0000", label: "🔴 IMMEDIATE", pulse: true },
  Urgent:       { color: "#ff8c00", bg: "#1a0800", label: "🟠 URGENT",    pulse: false },
  "Non-Urgent": { color: "#00c853", bg: "#001a08", label: "🟢 NON-URGENT",pulse: false },
};

export default function App() {
  const [data, setData] = useState(null);
  const [alertTime, setAlertTime] = useState(null);
  const [flash, setFlash] = useState(false);
  const [nurseLang, setNurseLang] = useState("English");
  const prevEscalation = useRef(false);

  const t = NURSE_LANGS[nurseLang];

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/summary/latest`);
        if (!res.ok) return;
        const json = await res.json();
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
  const pConfig  = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG["Non-Urgent"];
  const escalation = data?.escalation_alert;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0a0a0f", minHeight: "100vh", color: "#e8e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {escalation?.triggered && (
        <div style={{
          background: flash ? "#ff0000" : "#8b0000",
          padding: "16px 32px", display: "flex", alignItems: "center", gap: "16px",
          borderBottom: "3px solid #ff2d2d", transition: "background 0.2s",
          animation: flash ? "flashAnim 0.4s ease infinite" : "none"
        }}>
          <span style={{ fontSize: "28px" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.05em" }}>
              {t.escalationPrefix} — {escalation.reason}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "13px", opacity: 0.85, marginTop: "4px" }}>
              {t.patientSaid}: "<span style={{ fontStyle: "italic" }}>{escalation.original_phrase}</span>"
            </div>
            {alertTime && (
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "2px" }}>
                {t.alertAt} {alertTime}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{
        background: "#111118", borderBottom: "1px solid #222235",
        padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#7eb8ff", letterSpacing: "-0.02em" }}>ClearCare</span>
          <span style={{ color: "#555", fontSize: "13px" }}>{t.nurseDashboard}</span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "#556", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t.selectLang}:
            </span>
            <select
              value={nurseLang}
              onChange={e => setNurseLang(e.target.value)}
              style={{
                background: "#1a2035", border: "1px solid #2a3555",
                color: "#e8e8f0", padding: "5px 10px",
                borderRadius: "8px", fontSize: "13px", cursor: "pointer"
              }}
            >
              {Object.entries(NURSE_LANGS).map(([key, val]) => (
                <option key={key} value={key}>{val.flag} {val.label}</option>
              ))}
            </select>
          </div>
          {data?.language && (
            <span style={{ background: "#1a2035", border: "1px solid #2a3555", padding: "6px 14px", borderRadius: "20px", fontSize: "13px" }}>
              🌐 {t.detectedLanguage}: {data.language}
            </span>
          )}
          {priority && (
            <span style={{
              background: pConfig.bg, border: `2px solid ${pConfig.color}`,
              color: pConfig.color, padding: "6px 18px", borderRadius: "20px",
              fontWeight: 700, fontSize: "13px", letterSpacing: "0.08em",
              animation: pConfig.pulse ? "pulseBadge 1.2s ease infinite" : "none"
            }}>
              {pConfig.label}
            </span>
          )}
        </div>
      </div>

      {!data ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: "16px", opacity: 0.4 }}>
          <div style={{ fontSize: "48px" }}>🏥</div>
          <div style={{ fontSize: "16px" }}>{t.waiting}</div>
          <div style={{ fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>{t.polling}</div>
        </div>
      ) : (
        <div style={{ padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ background: "#111118", border: "1px solid #222235", borderRadius: "16px", padding: "28px", gridColumn: "1 / -1" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#556", fontWeight: 600, marginBottom: "20px", textTransform: "uppercase" }}>
              {t.triageSummary}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.chiefComplaint}</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>{data.summary.chief_complaint}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.onset}</div>
                <div style={{ fontSize: "16px", color: "#c8c8d8" }}>{data.summary.symptom_onset}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.severity}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: pConfig.color }}>{data.summary.severity_1_to_10}</span>
                  <span style={{ color: "#556" }}>/10</span>
                  <div style={{ flex: 1, background: "#1a1a2e", borderRadius: "4px", height: "8px" }}>
                    <div style={{ width: `${(data.summary.severity_1_to_10 / 10) * 100}%`, background: pConfig.color, height: "100%", borderRadius: "4px", transition: "width 0.5s ease" }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "24px" }}>
              <div style={{ fontSize: "11px", color: "#556", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.redFlags}</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {data.summary.red_flags.map((flag, i) => (
                  <span key={i} style={{ background: "#1a0000", border: "1px solid #ff2d2d44", color: "#ff6666", padding: "5px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 500 }}>
                    ⚑ {flag}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: "24px", background: "#0d1f0d", border: "1px solid #1a3a1a", borderRadius: "10px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", color: "#4a8a4a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.recommendedAction}</div>
              <div style={{ fontSize: "15px", color: "#aaffaa", fontWeight: 500 }}>{data.summary.recommended_action}</div>
            </div>
          </div>
          <TranscriptPanel transcript={data.transcript} language={data.language} t={t} />
        </div>
      )}

      <style>{`
        @keyframes flashAnim { 0%,100% { background: #8b0000; } 50% { background: #ff0000; } }
        @keyframes pulseBadge { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}

function TranscriptPanel({ transcript, language, t }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: "#111118", border: "1px solid #222235", borderRadius: "16px", padding: "24px", gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#556", fontWeight: 600, textTransform: "uppercase" }}>
          {t.transcript} — <span style={{ color: "#7eb8ff" }}>{language}</span>
        </div>
        <button onClick={() => setOpen(!open)} style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", color: "#7eb8ff", padding: "5px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
          {open ? t.collapse : t.expand}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "320px", overflowY: "auto" }}>
          {transcript.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "assistant" ? "flex-start" : "flex-end" }}>
              <div style={{
                background: msg.role === "assistant" ? "#1a1a2e" : "#0d1a0d",
                border: `1px solid ${msg.role === "assistant" ? "#2a2a4a" : "#1a3a1a"}`,
                borderRadius: "12px", padding: "10px 16px", maxWidth: "65%",
                fontSize: "14px", color: msg.role === "assistant" ? "#a8b8e8" : "#a8e8a8"
              }}>
                <div style={{ fontSize: "10px", color: "#445", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {msg.role === "assistant" ? t.aiLabel : t.patientLabel}
                </div>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}