const { Server } = require("socket.io");
const { socketAuth } = require("./middleware");
const { registerChatHandlers } = require("./handlers/chat");
const { registerPersonalChatHandlers } = require("./handlers/personalChat");

function initializeSocketServer(httpServer, app) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  app.locals.broadcastMessage = (message) => {
    io.emit("message:created", {
      payload: message
    });
  };

  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log(`Socket connected for user ${socket.user.id}`);

    registerChatHandlers({
      socket,
      app
    });

    registerPersonalChatHandlers({
      io,
      socket
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected for user ${socket.user.id}: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error("Socket.IO error:", error);
    });
  });

  return io;
}

module.exports = initializeSocketServer;
