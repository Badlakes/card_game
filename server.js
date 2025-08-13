// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const rooms = {}; // { CODE: { host: ws, guest: ws } }

function generateCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.type === "create") {
        let code;
        do {
          code = generateCode();
        } while (rooms[code]);

        rooms[code] = { host: ws, guest: null };
        ws.role = "host";
        ws.roomCode = code;

        ws.send(JSON.stringify({ type: "roomCreated", code }));
      }

      if (msg.type === "join") {
        const room = rooms[msg.code];
        if (!room || room.guest) {
          ws.send(JSON.stringify({ type: "error", message: "Sala inválida ou cheia" }));
          return;
        }
        room.guest = ws;
        ws.role = "guest";
        ws.roomCode = msg.code;

        // Avisar host que guest entrou
        room.host.send(JSON.stringify({ type: "guestJoined" }));
        ws.send(JSON.stringify({ type: "joinedRoom", code: msg.code }));
      }

      if (msg.type === "signal") {
        const room = rooms[ws.roomCode];
        if (!room) return;
        if (ws.role === "host" && room.guest) {
          room.guest.send(JSON.stringify({ type: "signal", data: msg.data }));
        } else if (ws.role === "guest" && room.host) {
          room.host.send(JSON.stringify({ type: "signal", data: msg.data }));
        }
      }
    } catch (e) {
      console.error("Mensagem inválida:", e);
    }
  });

  ws.on("close", () => {
    if (ws.roomCode && rooms[ws.roomCode]) {
      const room = rooms[ws.roomCode];
      if (room.host === ws) {
        if (room.guest) room.guest.close();
        delete rooms[ws.roomCode];
      } else if (room.guest === ws) {
        if (room.host) room.host.close();
        delete rooms[ws.roomCode];
      }
    }
  });
});

console.log("Servidor de sinalização rodando...");
