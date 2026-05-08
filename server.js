const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const users = new Map();

io.on("connection", (socket) => {
  socket.on("join", ({ name }) => {
    socket.data.name = name || "Utente";
    users.set(socket.id, socket.data.name);

    socket.emit("me", socket.id);
    io.emit("users", Array.from(users.entries()).map(([id, name]) => ({ id, name })));
    io.emit("system", `${socket.data.name} è entrato`);
  });

  socket.on("message", (text) => {
    io.emit("message", {
      id: socket.id,
      name: socket.data.name || "Utente",
      text,
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    });
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", {
      from: socket.id,
      name: socket.data.name,
      data
    });
  });

  socket.on("disconnect", () => {
    const name = users.get(socket.id);
    users.delete(socket.id);

    io.emit("users", Array.from(users.entries()).map(([id, name]) => ({ id, name })));
    if (name) io.emit("system", `${name} è uscito`);
    io.emit("user-left", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`FabboCord avviato su porta ${PORT}`));