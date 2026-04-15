function registerChatHandlers({ socket, app }) {
  const { user } = socket;
  const groupChatService = app.locals.groupChatService;
  const { createTextMessage } = require("../../services/chatMessageFactory");
  const defaultGroupId = "general-group";

  function leaveCurrentGroupRoom(nextGroupId) {
    const currentRoomName = socket.data.activeGroupRoomName;

    if (currentRoomName && socket.data.activeGroupId !== nextGroupId) {
      socket.leave(currentRoomName);
    }
  }

  socket.emit("connection.ready", {
    user
  });

  try {
    const defaultGroup = groupChatService.joinGroup({
      groupId: defaultGroupId,
      user,
      socketId: socket.id
    });

    socket.join(`group:${defaultGroup.id}`);
    socket.data.activeGroupId = defaultGroup.id;
    socket.data.activeGroupRoomName = `group:${defaultGroup.id}`;
  } catch (error) {
    console.error("Unable to auto-join general group:", error);
  }

  socket.on("auth:me", (callback) => {
    callback?.({
      ok: true,
      user: socket.data.user
    });
  });

  socket.on("group:join", (payload = {}, callback) => {
    try {
      const group = groupChatService.joinGroup({
        groupId: payload.groupId,
        code: payload.code,
        user,
        socketId: socket.id
      });

      const roomName = `group:${group.id}`;
      leaveCurrentGroupRoom(group.id);
      socket.join(roomName);
      socket.data.activeGroupId = group.id;
      socket.data.activeGroupRoomName = roomName;

      app.locals.emitGroupUpdate?.(group.id);
      app.locals.emitGroupsToSocket?.(socket);

      callback?.({
        ok: true,
        group
      });
    } catch (error) {
      callback?.({
        ok: false,
        message: error.message || "Unable to join group"
      });
    }
  });

  socket.on("group:leave", (payload = {}, callback) => {
    const groupId = payload.groupId || socket.data.activeGroupId;
    const roomName = groupId ? `group:${groupId}` : socket.data.activeGroupRoomName;

    if (!roomName) {
      callback?.({
        ok: false,
        message: "No group room to leave"
      });
      return;
    }

    socket.leave(roomName);
    let group;

    try {
      group = groupChatService.leaveGroup({
        groupId,
        socketId: socket.id,
        userId: user.id
      });
    } catch (error) {
      callback?.({
        ok: false,
        message: error.message || "Unable to leave group"
      });
      return;
    }

    if (socket.data.activeGroupRoomName === roomName) {
      socket.data.activeGroupRoomName = null;
      socket.data.activeGroupId = null;
    }

    app.locals.emitGroupUpdate?.(group.id);
    app.locals.emitGroupsToSocket?.(socket);

    callback?.({
      ok: true,
      groupId
    });
  });

  socket.on("group:message:create", async (payload = {}, callback) => {
    try {
      const groupId = payload.groupId || socket.data.activeGroupId;
      const trimmedMessage = payload.message?.trim();

      if (!trimmedMessage) {
        throw new Error("Message is required");
      }

      let savedMessage;

      if (groupId === defaultGroupId && app.locals.persistGeneralMessage) {
        const dbMessage = await app.locals.persistGeneralMessage({
          userId: user.id,
          message: trimmedMessage
        });

        savedMessage = {
          id: dbMessage.id,
          groupId,
          type: "text",
          message: dbMessage.message,
          userId: dbMessage.userId,
          sender: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          createdAt: dbMessage.createdAt
        };
      } else {
        savedMessage = createTextMessage({
          groupId,
          message: trimmedMessage,
          user
        });
      }

      groupChatService.appendExistingMessage({
        groupId,
        message: savedMessage
      });
      app.locals.emitGroupMessage?.(groupId, savedMessage);

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
