exports.listGroups = async (req, res) => {
  try {
    const groups = req.app.locals.groupChatService.listGroups();

    return res.status(200).json({
      groups
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to fetch groups",
      error: error.message
    });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const group = req.app.locals.groupChatService.createGroup({
      name: req.body.name,
      user: req.user
    });

    req.app.locals.broadcastGroups?.();

    return res.status(201).json({
      message: "Group created successfully",
      group
    });
  } catch (error) {
    const statusCode = error.message === "Group name is required" ? 400 : 404;

    return res.status(statusCode).json({
      message: error.message,
      error: error.message
    });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const group = req.app.locals.groupChatService.joinGroup({
      groupId: req.body.groupId,
      code: req.body.code,
      user: req.user
    });

    req.app.locals.broadcastGroups?.();

    return res.status(200).json({
      message: "Joined group successfully",
      group
    });
  } catch (error) {
    const statusCode = error.message === "Group not found" ? 404 : 400;

    return res.status(statusCode).json({
      message: error.message,
      error: error.message
    });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const rawMessages = req.app.locals.groupChatService.getGroupMessages(req.params.groupId);
    const messages = await Promise.all(
      rawMessages.map((message) => req.app.locals.s3MediaService.hydrateMediaMessage(message))
    );

    return res.status(200).json({
      messages
    });
  } catch (error) {
    const statusCode = error.message === "Group not found" ? 404 : 500;

    return res.status(statusCode).json({
      message: error.message,
      error: error.message
    });
  }
};
