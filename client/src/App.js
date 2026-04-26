// ============================================================
// App.js — ClearCare Nurse Dashboard (v2)
// Polls backend every 2s for patient data from Reyansh's app
// Nurse can switch UI language via dropdown
// Summary fields translate via Claude API when nurse changes language
// ============================================================

import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:4000";
const ANTHROPIC_KEY = "RAY-API-KEY";

// Translates a single piece of text using Claude Haiku
async function translateText(text, targetLang) {
  if (targetLang === "English") return text;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Translate this medical text to ${targetLang}. Return ONLY the translated text, nothing else: "${text}"`
        }]
      })
    });
    const data = await res.json();
    return data.content[0].text;
  } catch (e) {
    return text;
  }
}

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
  const [translating, setTranslating] = useState(false);
  const prevEscalation = useRef(false);
  const lastTranslatedLang = useRef("English");

  const t = NURSE_LANGS[nurseLang];

  // Poll for summary every 2 seconds
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/summary/latest`);
        if (!res.ok) return;
        const json = await res.json();

        // Translate summary fields if nurse picked non-English
        if (nurseLang !== "English") {
          setTranslating(true);
          const [cc, onset, action, flags] = await Promise.all([
            translateText(json.summary.chief_complaint, nurseLang),
            translateText(json.summary.symptom_onset, nurseLang),
            translateText(json.summary.recommended_action, nurseLang),
            Promise.all(json.summary.red_flags.map(f => translateText(f, nurseLang)))
          ]);
          json.summary.chief_complaint = cc;
          json.summary.symptom_onset = onset;
          json.summary.recommended_action = action;
          json.summary.red_flags = flags;
          setTranslating(false);
        }

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
  }, [nurseLang]); // re-runs when nurse changes language

  // Re-translate existing data when nurse switches language
  useEffect(() => {
    if (!data || nurseLang === lastTranslatedLang.current) return;
    lastTranslatedLang.current = nurseLang;

    async function retranslate() {
      setTranslating(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/summary/latest`);
        if (!res.ok) return;
        const json = await res.json();

        if (nurseLang !== "English") {
          const [cc, onset, action, flags] = await Promise.all([
            translateText(json.summary.chief_complaint, nurseLang),
            translateText(json.summary.symptom_onset, nurseLang),
            translateText(json.summary.recommended_action, nurseLang),
            Promise.all(json.summary.red_flags.map(f => translateText(f, nurseLang)))
          ]);
          json.summary.chief_complaint = cc;
          json.summary.symptom_onset = onset;
          json.summary.recommended_action = action;
          json.summary.red_flags = flags;
        }
        setData(json);
      } catch (e) {}
      setTranslating(false);
    }
    retranslate();
  }, [nurseLang]);

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
          {translating && <span style={{ fontSize: "11px", color: "#7eb8ff", opacity: 0.7 }}>Translating...</span>}
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
                <div style={{ fontSize: "11px", color: "#556", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em"