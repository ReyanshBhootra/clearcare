const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ── RAY'S EXISTING ENDPOINTS (don't touch these) ──────────
app.post("/api/chat", async (req, res) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/transcribe", async (req, res) => {
  try {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      const audioBuffer = Buffer.concat(chunks);
      const response = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&smart_format=true&language=multi",
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${process.env.DEEPGRAM_KEY}`,
            "Content-Type": "audio/webm"
          },
          body: audioBuffer
        }
      );
      const data = await response.json();
      const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || "";
      res.json({ transcript });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SHIPPY'S ENDPOINTS (these feed her nurse dashboard) ───
// Store latest data in memory
let latestSummary = null;
let latestEscalation = null;

// Your app POSTs the full triage JSON here after conversation ends
app.post("/api/summary", (req, res) => {
  latestSummary = req.body;
  console.log("📋 Summary received from patient side!");
  res.status(200).json({ status: "ok" });
});

// Your app POSTs here the MOMENT a dangerous keyword is detected
app.post("/api/escalation", (req, res) => {
  latestEscalation = req.body;
  console.log("🚨 Escalation received!");
  res.status(200).json({ status: "ok" });
});

// Shippy's dashboard polls these every 2 seconds
app.get("/api/summary/latest", (req, res) => {
  if (!latestSummary) return res.status(404).json({ error: "No summary yet" });
  res.json(latestSummary);
});

app.get("/api/escalation/latest", (req, res) => {
  if (!latestEscalation) return res.status(404).json({ error: "No escalation yet" });
  res.json(latestEscalation);
});

// ── START SERVER ──────────────────────────────────────────
app.listen(4000, () => console.log("✅ Server running on port 4000"));