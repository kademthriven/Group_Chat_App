const { Message, User } = require("../models");

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name"]
        }
      ],
      order: [["createdAt", "ASC"]]
    });

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
    const savedMessage = await req.app.locals.persistMessage({
      userId: req.user.id,
      message: req.body.message
    });

    req.app.locals.broadcastMessage?.(savedMessage);

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
