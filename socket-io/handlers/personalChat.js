function buildRoomName(userIdA, userIdB) {
  return [Number(userIdA), Number(userIdB)].sort((a, b) => a - b).join(":");
}

function registerPersonalChatHandlers({ io, socket }) {
  socket.on("join_room", (payload = {}, callback) => {
    const targetUserId = Number(payload.targetUserId);

    if (!targetUserId) {
      callback?.({
        ok: false,
        message: "A target user is required"
      });
      return;
    }

    const room = buildRoomName(socket.user.id, targetUserId);
    socket.join(room);
    socket.data.personalRoom = room;

    callback?.({
      ok: true,
      room
    });
  });

  socket.on("new_message", (payload = {}, callback) => {
    const targetUserId = Number(payload.targetUserId);
    const message = payload.message?.trim();

    if (!targetUserId) {
      callback?.({
        ok: false,
        message: "A target user is required"
      });
      return;
    }

    if (!message) {
      callback?.({
        ok: false,
        message: "Message is required"
      });
      return;
    }

    const room = buildRoomName(socket.user.id, targetUserId);
    const personalMessage = {
      room,
      message,
      userId: socket.user.id,
      targetUserId,
      sender: {
        id: socket.user.id,
        name: socket.user.name
      },
      createdAt: new Date().toISOString()
    };

    io.to(room).emit("personal_message", {
      payload: personalMessage
    });

    callback?.({
      ok: true,
      data: personalMessage
    });
  });
}

module.exports = {
  registerPersonalChatHandlers
};
