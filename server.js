const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "62621762"; // your secret code

app.use(express.json());

// Function to log with IP, time, and route
function logAccess(req, message) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const time = new Date().toLocaleString();
  console.log(`[${time}] [${ip}] ${message}`);
}

// Route: homepage (fun message)
app.get("/", (req, res) => {
  logAccess(req, "visited home");
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  res.send(`
    <h1 style="font-family:monospace;text-align:center;margin-top:100px;">
      Gaddar! Tune gaddari karke achcha nahi kiya!<br>
      Tune bola tha Aternos ke alawa koi web nahi khulta,<br>
      lekin ye web kaise khula?! 😏<br><br>
      <small>Your IP has been logged: ${ip}</small>
    </h1>
  `);
});

// Route: get inv
app.get("/inv/:player/:secret", (req, res) => {
  const { player, secret } = req.params;
  logAccess(req, `tried to view ${player}'s inventory`);
  if (secret !== SECRET) return res.status(403).send("Invalid secret key!");

  if (player !== "archit_pro2013")
    return res.status(403).send("Access denied. Only archit_pro2013 allowed!");

  const filePath = path.join(__dirname, "data", `${player}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).send("Inventory not found.");

  const invData = fs.readFileSync(filePath, "utf8");
  res.send(`<pre>${invData}</pre>`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
