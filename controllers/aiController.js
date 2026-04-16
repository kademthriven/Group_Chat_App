const { getChatSuggestions } = require("../services/geminiChatService");

exports.getSuggestions = async (req, res) => {
  try {
    const {
      draft = "",
      recentMessages = [],
      conversationType = "group",
      conversationName = "Chat"
    } = req.body || {};

    const suggestions = await getChatSuggestions({
      draft,
      recentMessages: Array.isArray(recentMessages) ? recentMessages : [],
      currentUser: req.user || {},
      conversationType,
      conversationName
    });

    return res.status(200).json(suggestions);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to generate suggestions",
      error: error.message
    });
  }
};
