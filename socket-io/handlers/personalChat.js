function normalizeRoomId(roomId = "") {
  return roomId.trim().toLowerCase();
}

function registerPersonalChatHandlers({ socket }) {
  socket.on("join_room", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId);

    if (!roomId) {
      callback?.({
        ok: false,
        message: "A room ID is required"
      });
      return;
    }

    if (socket.data.personalRoom && socket.data.personalRoom !== roomId) {
      socket.leave(socket.data.personalRoom);
    }

    socket.join(roomId);
    socket.data.personalRoom = roomId;

    callback?.({
      ok: true,
      roomId
    });
  });

  socket.on("leave_room", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId || socket.data.personalRoom);

    if (!roomId) {
      callback?.({
        ok: false,
        message: "No room to leave"
      });
      return;
    }

    socket.leave(roomId);

    if (socket.data.personalRoom === roomId) {
      socket.data.personalRoom = null;
    }

    callback?.({
      ok: true,
      roomId
    });
  });

  socket.on("new_message", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId || socket.data.personalRoom);
    const message = payload.message?.trim();

    if (!roomId) {
      callback?.({
        ok: false,
        message: "A room ID is required"
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

    const personalMessage = {
      roomId,
      message,
      userId: socket.user.id,
      recipientEmail: payload.recipientEmail || null,
      sender: {
        id: socket.user.id,
        name: socket.user.name,
        email: socket.user.email
      },
      createdAt: new Date().toISOString()
    };

    socket.to(roomId).emit("new_message", {
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
