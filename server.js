const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const configs = [];
const chatMessages = [];
const presence = {};

let nextConfigId = 1;
let nextChatId = 1;

app.get("/configs", (req, res) => {
  res.json({ Items: configs, NextCursor: null });
});

app.get("/configs/mine", (req, res) => {
  const id = req.headers["x-nullui-identity"];
  res.json({ Items: configs.filter(c => c.OwnerIdentity === id) });
});

app.post("/configs", (req, res) => {
  const id = req.headers["x-nullui-identity"];
  const { Name, Description, Tags, Data } = req.body;
  const ownerToken = Math.random().toString(36).slice(2);
  const config = {
    Id: String(nextConfigId++),
    Name, Description, Tags, Data,
    OwnerIdentity: id,
    OwnerToken: ownerToken,
    Likes: 0,
    Downloads: 0,
    CreatedAtText: new Date().toISOString(),
  };
  configs.push(config);
  res.json({ Id: config.Id, OwnerToken: ownerToken });
});

app.delete("/configs/:id", (req, res) => {
  const token = req.headers["x-nullui-owner-token"];
  const idx = configs.findIndex(c => c.Id === req.params.id && c.OwnerToken === token);
  if (idx === -1) return res.status(403).json({ error: "Not authorized" });
  configs.splice(idx, 1);
  res.json({ ok: true });
});

app.post("/configs/:id/like", (req, res) => {
  const c = configs.find(c => c.Id === req.params.id);
  if (c) c.Likes++;
  res.json({ ok: true });
});

app.post("/configs/:id/download", (req, res) => {
  const c = configs.find(c => c.Id === req.params.id);
  if (!c) return res.status(404).json({ error: "Not found" });
  c.Downloads++;
  res.json({ Data: c.Data });
});

app.post("/chat/send", (req, res) => {
  const { UserId, Text } = req.body;
  if (!Text || Text.length > 500) return res.status(400).json({ error: "Bad message" });
  const msg = {
    Id: nextChatId++,
    UserId: UserId || 0,
    Text,
    CreatedAt: Date.now(),
    Reports: 0,
  };
  chatMessages.push(msg);
  if (chatMessages.length > 500) chatMessages.shift();
  res.json(msg);
});

app.get("/chat", (req, res) => {
  const since = parseInt(req.query.since) || 0;
  res.json({ Messages: chatMessages.filter(m => m.Id > since && m.Reports < 3) });
});

app.post("/chat/:id/report", (req, res) => {
  const m = chatMessages.find(m => m.Id === parseInt(req.params.id));
  if (m) m.Reports++;
  res.json({ ok: true });
});

app.post("/presence/heartbeat", (req, res) => {
  const id = req.headers["x-nullui-identity"];
  presence[id] = { lastSeen: Date.now(), ...req.body };
  res.json({ ok: true });
});

app.get("/presence/count", (req, res) => {
  const now = Date.now();
  const active = Object.values(presence).filter(p => now - p.lastSeen < 60000).length;
  res.json({ Count: active });
});

app.get("/presence/leaderboard", (req, res) => {
  const now = Date.now();
  const items = Object.entries(presence)
    .filter(([_, p]) => now - p.lastSeen < 300000)
    .map(([id, p]) => ({
      Identity: id,
      UserId: p.UserId || 0,
      NamePreview: p.NamePreview || "",
      Seconds: Math.floor((now - p.lastSeen) / 1000) + 60,
    }))
    .sort((a, b) => b.Seconds - a.Seconds)
    .slice(0, parseInt(req.query.limit) || 10);
  res.json({ Items: items });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "NullUI backend" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("NullUI backend running on port " + PORT);
});
