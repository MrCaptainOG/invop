// index.js
// Express app: homepage logs visitor IP; /inventory shows archit_pro2013 inventory from data file.
// POST /inventory-upload accepts JSON from trusted exporter (header X-ADMIN-TOKEN: 62621762).
// Admin routes: /logs (HTML) and /download-logs (raw file). Use header x-admin-token or ?token=.

// SECURITY: Hardcoded admin token (owner requested): 62621762
import express from "express";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_TOKEN = "62621762"; // hardcoded - keep secret
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "visitors.log");
const DATA_DIR = path.join(process.cwd(), "data");
const ARCHIT_FILE = path.join(DATA_DIR, "archit_pro2013.json");

// ensure dirs
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// helpers
function getClientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}
function normalizeIP(ip) {
  if (!ip) return "unknown";
  return ip.replace(/^::ffff:/, "");
}
function appendLog(obj) {
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(obj) + "\n"); }
  catch (e) { console.error("Failed to write log:", e); }
}
function isAdmin(req) {
  const token = (req.query.token || req.headers["x-admin-token"] || "").toString();
  return token === ADMIN_TOKEN;
}
function safe(s){ return String(s||"").replace(/</g,"&lt;"); }

// middleware
app.use(helmet());
app.use(bodyParser.json({ limit: '300kb' })); // accept JSON POST from Skript

// ROOT: message + log visit
app.get("/", (req, res) => {
  const rawIp = getClientIP(req);
  const ip = normalizeIP(rawIp);
  const ua = req.headers["user-agent"] || "unknown";
  const time = new Date().toISOString();
  const entry = { time, ip, userAgent: ua, path: req.path, host: req.headers.host };
  console.log(`[GADDAR] ${time} - VISIT - IP: ${ip} - UA: ${ua}`);
  appendLog(entry);

  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.send(`
    <body style="background:#000;color:#ff4444;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="text-align:center">
        <h1>Gaddar! Tune gaddari karke achha nahi kiya 😏</h1>
        <p style="color:#ddd">Tune bola tha Aternos ke alawa koi web nahi khulta — lekin ye web kaise khul gaya?</p>
      </div>
    </body>
  `);
});

// GET /inventory -> show archit_pro2013 inventory (data file)
app.get("/inventory", (req, res) => {
  // log view
  const rawIp = getClientIP(req);
  const ip = normalizeIP(rawIp);
  const ua = req.headers["user-agent"] || "unknown";
  const time = new Date().toISOString();
  const entry = { time, ip, userAgent: ua, path: req.path, action: "inventory_view", target: "archit_pro2013" };
  console.log(`[GADDAR INV] ${time} - VIEW - target: archit_pro2013 - IP: ${ip} - UA: ${ua}`);
  appendLog(entry);

  if (!fs.existsSync(ARCHIT_FILE)) {
    return res.status(503).send(`<h2 style="text-align:center;color:#c0392b">Inventory not available</h2><p style="text-align:center;color:#666">archit_pro2013's inventory file is missing.</p>`);
  }
  try {
    const raw = fs.readFileSync(ARCHIT_FILE, "utf8");
    const data = JSON.parse(raw);
    // render simple html
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Inventory - archit_pro2013</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;color:#111;padding:18px}h1{color:#111}.slot{border:1px solid #eee;padding:8px;margin:6px;border-radius:6px;background:#fff;display:inline-block;min-width:200px}</style></head><body>`;
    html += `<h1>Inventory — <strong>archit_pro2013</strong></h1>`;
    if (!Array.isArray(data.items) || data.items.length === 0) {
      html += `<p>No items recorded.</p>`;
    } else {
      html += `<div>`;
      for (const it of data.items) {
        const name = safe(it.name || it.id || "Unknown Item");
        const qty = safe(it.amount || it.count || "");
        const ench = it.enchantments ? safe(JSON.stringify(it.enchantments)) : "";
        html += `<div class="slot"><strong>${name}</strong><br/>Qty: ${qty}${ench ? `<br/>Ench: ${ench}` : ""}</div>`;
      }
      html += `</div>`;
    }
    html += `<p style="color:#666;margin-top:18px">This page only shows archit_pro2013's inventory (read-only).</p>`;
    html += `</body></html>`;
    res.send(html);
  } catch (e) {
    console.error("Failed to parse archit inventory:", e);
    res.status(500).send(`<p style="color:red;text-align:center">Failed to load inventory data.</p>`);
  }
});

// POST /inventory-upload -> owner/Skript posts JSON to update archit inventory
app.post("/inventory-upload", (req, res) => {
  const token = (req.headers['x-admin-token'] || req.query.token || "").toString();
  if (token !== ADMIN_TOKEN) return res.status(403).json({ ok:false, error:"forbidden" });

  const body = req.body;
  if (!body || body.player !== 'archit_pro2013' || !Array.isArray(body.items)) {
    return res.status(400).json({ ok:false, error:"bad_payload" });
  }

  try {
    fs.writeFileSync(ARCHIT_FILE, JSON.stringify(body, null, 2), 'utf8');
    const time = new Date().toISOString();
    const srcIp = normalizeIP(getClientIP(req));
    console.log(`[INV-UPLOAD] ${time} - Received inventory upload for archit_pro2013 from ${srcIp} - items:${body.items.length}`);
    appendLog({ time, ip: srcIp, action: "inventory_upload", target: "archit_pro2013" });
    return res.json({ ok:true });
  } catch (e) {
    console.error("Failed to save inventory file:", e);
    return res.status(500).json({ ok:false });
  }
});

// Admin: /logs (HTML)
app.get("/logs", (req, res) => {
  if (!isAdmin(req)) return res.status(403).send("Forbidden - invalid token");
  if (!fs.existsSync(LOG_FILE)) return res.send("<p>No logs.</p>");
  const raw = fs.readFileSync(LOG_FILE, "utf8").trim();
  if (!raw) return res.send("<p>No logs.</p>");
  const lines = raw.split("\n").filter(Boolean).reverse();
  const entries = lines.map(l => { try { return JSON.parse(l); } catch(e){ return { raw:l }; } });
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Visitor Logs</title>
    <style>body{font-family:Arial;margin:18px;background:#f7fafc}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{background:#edf2f7}</style></head><body>`;
  html += `<h2>Visitor Logs — ${entries.length} entries</h2><table><thead><tr><th>Time</th><th>IP</th><th>Action</th><th>UA</th><th>Path</th></tr></thead><tbody>`;
  for (const e of entries) {
    html += `<tr><td>${safe(e.time)}</td><td>${safe(e.ip)}</td><td>${safe(e.action||'visit')}</td><td style="max-width:420px">${safe(e.userAgent)}</td><td>${safe(e.path)}</td></tr>`;
  }
  html += `</tbody></table></body></html>`;
  res.send(html);
});

// Admin: download raw logs
app.get("/download-logs", (req, res) => {
  if (!isAdmin(req)) return res.status(403).send("Forbidden - invalid token");
  if (!fs.existsSync(LOG_FILE)) return res.status(404).send("No logs.");
  res.download(LOG_FILE, "visitors.log");
});

// health
app.get("/health", (req, res) => res.send("ok"));

// fallback
app.use((req, res) => res.status(404).send("Not found"));

app.listen(PORT, () => {
  console.log(`🚀 gaddar-inv listening on port ${PORT}. Admin token is hardcoded (keep secret).`);
});
