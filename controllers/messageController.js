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
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required"
      });
    }

    const newMessage = await Message.create({
      userId: req.user.id,
      message: message.trim()
    });

    const savedMessage = await Message.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name"]
        }
      ]
    });

    return res.status(201).json({
      message: "Message stored successfully",
      data: savedMessage
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to save message",
      error: error.message
    });
  }
};
