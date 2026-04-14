function registerChatHandlers({ socket, app }) {
  const { user } = socket;

  socket.emit("connection.ready", {
    user
  });

  socket.on("auth:me", (callback) => {
    callback?.({
      ok: true,
      user: socket.data.user
    });
  });

  socket.on("message:create", async (payload = {}, callback) => {
    try {
      const savedMessage = await app.locals.persistMessage({
        userId: user.id,
        message: payload.message
      });

      app.locals.broadcastMessage(savedMessage);
      callback?.({
        ok: true,
        data: savedMessage
      });
    } catch (error) {
      callback?.({
        ok: false,
        message: error.message || "Unable to save message"
      });
    }
  });
}

module.exports = {
  registerChatHandlers
};
