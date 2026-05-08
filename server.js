const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  perMessageDeflate: false,
  maxHttpBufferSize: 1e6
});

app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: "1h"
}));

const users = new Map();

function listUsers() {
  return Array.from(users.entries()).map(([id, u]) => ({
    id,
    name: u.name,
    color: u.color,
    inVoice: !!u.inVoice,
    mic: !!u.mic,
    cam: !!u.cam,
    screen: !!u.screen
  }));
}

function sendUsers() {
  io.emit("users", listUsers());
}

io.on("connection", socket => {
  socket.on("join", ({ name, color }) => {
    const finalName = String(name || "Utente").trim().slice(0, 24) || "Utente";
    users.set(socket.id, {
      name: finalName,
      color: color || "#5865f2",
      inVoice: false,
      mic: false,
      cam: false,
      screen: false
    });

    socket.data.name = finalName;
    socket.data.color = color || "#5865f2";

    socket.emit("me", socket.id);
    sendUsers();
    io.emit("system", `${finalName} è entrato`);
  });

  socket.on("profile", ({ name, color }) => {
    const u = users.get(socket.id);
    if (!u) return;
    u.name = String(name || u.name || "Utente").trim().slice(0, 24) || "Utente";
    u.color = color || u.color || "#5865f2";
    socket.data.name = u.name;
    socket.data.color = u.color;
    sendUsers();
  });

  socket.on("voice", state => {
    const u = users.get(socket.id);
    if (!u) return;
    u.inVoice = !!state.inVoice;
    u.mic = !!state.mic;
    u.cam = !!state.cam;
    u.screen = !!state.screen;
    sendUsers();
  });

  socket.on("message", text => {
    const u = users.get(socket.id);
    io.emit("message", {
      id: socket.id,
      name: u?.name || socket.data.name || "Utente",
      color: u?.color || socket.data.color || "#5865f2",
      text: String(text || "").slice(0, 800),
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    });
  });

  socket.on("signal", ({ to, data }) => {
    if (to && data) io.to(to).emit("signal", { from: socket.id, name: socket.data.name, data });
  });

  socket.on("disconnect", () => {
    const u = users.get(socket.id);
    users.delete(socket.id);
    sendUsers();
    if (u) io.emit("system", `${u.name} è uscito`);
    io.emit("user-left", socket.id);
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0");
