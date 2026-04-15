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
  app.locals.io = io;
  app.locals.emitGroupMessage = (groupId, message) => {
    io.to(`group:${groupId}`).emit("group:message", {
      payload: message
    });
  };
  app.locals.emitPersonalMessage = (roomId, message) => {
    io.to(roomId).emit("new_message", {
      payload: message
    });
  };
  app.locals.emitGroupsToSocket = (targetSocket) => {
    targetSocket.emit("groups:updated", {
      groups: app.locals.groupChatService.listGroups()
    });
  };
  app.locals.emitGroupUpdate = (groupId) => {
    const group = app.locals.groupChatService.listGroups().find((entry) => entry.id === groupId);

    if (!group) {
      return;
    }

    io.to(`group:${groupId}`).emit("group:updated", {
      group
    });
  };

  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log(`Socket connected for user ${socket.user.id}`);
    app.locals.emitGroupsToSocket(socket);

    registerChatHandlers({
      socket,
      app
    });

    registerPersonalChatHandlers({
      socket
    });

    socket.on("disconnect", (reason) => {
      const updatedGroups = app.locals.groupChatService.disconnectSocket(socket.id);
      updatedGroups.forEach((group) => {
        io.to(`group:${group.id}`).emit("group:updated", {
          group
        });
      });
      console.log(`Socket disconnected for user ${socket.user.id}: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error("Socket.IO error:", error);
    });
  });

  return io;
}

module.exports = initializeSocketServer;
