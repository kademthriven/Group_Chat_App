const { User } = require("../../models");
const { normalizeEmail, generatePersonalRoomId } = require("../../utils/personalRoom");

function normalizeRoomId(roomId = "") {
  return roomId.trim().toLowerCase();
}

function registerPersonalChatHandlers({ socket }) {
  socket.on("join_room", async (payload = {}, callback) => {
    try {
      const targetEmail = normalizeEmail(payload.targetEmail);
      const roomId = generatePersonalRoomId(socket.user.email, targetEmail);

      if (!targetEmail) {
        callback?.({
          ok: false,
          message: "A target email is required"
        });
        return;
      }

      if (!roomId) {
        callback?.({
          ok: false,
          message: "A valid personal room ID is required"
        });
        return;
      }

      if (payload.roomId && normalizeRoomId(payload.roomId) !== roomId) {
        callback?.({
          ok: false,
          message: "Room ID does not match the selected users"
        });
        return;
      }

      const recipient = await User.findOne({
        where: {
          email: targetEmail
        },
        attributes: ["id", "name", "email"]
      });

      if (!recipient) {
        callback?.({
          ok: false,
          message: "User not found"
        });
        return;
      }

      if (socket.data.personalRoom && socket.data.personalRoom !== roomId) {
        socket.leave(socket.data.personalRoom);
      }

      socket.join(roomId);
      socket.data.personalRoom = roomId;
      socket.data.personalRecipient = recipient.toJSON();

      callback?.({
        ok: true,
        roomId,
        recipient: socket.data.personalRecipient
      });
    } catch (error) {
      callback?.({
        ok: false,
        message: "Unable to join personal room"
      });
    }
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
      socket.data.personalRecipient = null;
    }

    callback?.({
      ok: true,
      roomId
    });
  });

  socket.on("new_message", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId || socket.data.personalRoom);
    const message = payload.message?.trim();
    const recipientEmail = normalizeEmail(payload.recipientEmail || socket.data.personalRecipient?.email);

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

    if (!recipientEmail) {
      callback?.({
        ok: false,
        message: "Recipient email is required"
      });
      return;
    }

    if (generatePersonalRoomId(socket.user.email, recipientEmail) !== roomId) {
      callback?.({
        ok: false,
        message: "Recipient email does not match this room"
      });
      return;
    }

    const personalMessage = {
      roomId,
      message,
      userId: socket.user.id,
      recipientEmail,
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
