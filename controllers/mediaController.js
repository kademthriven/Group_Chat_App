const { createMediaMessage } = require("../services/chatMessageFactory");
const { User } = require("../models");
const { generatePersonalRoomId, normalizeEmail } = require("../utils/personalRoom");

exports.uploadMedia = async (req, res) => {
  try {
    const conversationType = req.body.conversationType;

    if (!req.file) {
      return res.status(400).json({
        message: "A media file is required"
      });
    }

    const uploadResult = await req.app.locals.s3MediaService.uploadFile(req.file);
    const userRecord = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email"]
    });

    if (!userRecord) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const currentUser = userRecord.toJSON();

    if (conversationType === "group") {
      const groupId = req.body.groupId;

      if (!groupId) {
        return res.status(400).json({
          message: "Group ID is required"
        });
      }

      req.app.locals.groupChatService.joinGroup({
        groupId,
        user: currentUser
      });

      const mediaMessage = createMediaMessage({
        groupId,
        user: currentUser,
        mediaUrl: uploadResult.url,
        mediaKey: uploadResult.key,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      });

      req.app.locals.groupChatService.appendExistingMessage({
        groupId,
        message: mediaMessage
      });
      req.app.locals.emitGroupMessage?.(groupId, mediaMessage);

      return res.status(201).json({
        ok: true,
        data: mediaMessage
      });
    }

    if (conversationType === "personal") {
      const recipientEmail = normalizeEmail(req.body.recipientEmail);
      const roomId = generatePersonalRoomId(currentUser.email, recipientEmail);

      if (!recipientEmail || !roomId) {
        return res.status(400).json({
          message: "Recipient email is required"
        });
      }

      const mediaMessage = createMediaMessage({
        roomId,
        user: currentUser,
        recipientEmail,
        mediaUrl: uploadResult.url,
        mediaKey: uploadResult.key,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      });

      req.app.locals.emitPersonalMessage?.(roomId, mediaMessage);

      return res.status(201).json({
        ok: true,
        data: mediaMessage
      });
    }

    return res.status(400).json({
      message: "A valid conversation type is required"
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to upload media"
    });
  }
};
