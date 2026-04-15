exports.getMessages = async (req, res) => {
  try {
    const messages = req.app.locals.groupChatService.getGroupMessages("general-group");

    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to fetch messages",
      error: error.message
    });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const savedMessage = req.app.locals.groupChatService.addMessage({
      groupId: "general-group",
      user: req.user,
      message: req.body.message
    });

    req.app.locals.broadcastGroups?.();
    req.app.locals.io?.to("group:general-group").emit("group:message", {
      payload: savedMessage
    });

    return res.status(201).json({
      message: "Message stored successfully",
      data: savedMessage
    });
  } catch (error) {
    const statusCode = error.message === "Message is required" ? 400 : 500;

    return res.status(statusCode).json({
      message: statusCode === 400 ? error.message : "Unable to save message",
      error: error.message
    });
  }
};
