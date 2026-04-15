function createTextMessage({ roomId = null, groupId = null, message, user, recipientEmail = null }) {
  return {
    id: `${groupId || roomId || "message"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    groupId,
    type: "text",
    message,
    userId: user.id,
    recipientEmail,
    sender: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    createdAt: new Date().toISOString()
  };
}

function getMediaType(mimeType = "") {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "file";
}

function createMediaMessage({
  roomId = null,
  groupId = null,
  user,
  recipientEmail = null,
  mediaUrl,
  mediaKey,
  fileName,
  mimeType,
  fileSize
}) {
  return {
    id: `${groupId || roomId || "media"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    groupId,
    type: "media",
    message: fileName,
    userId: user.id,
    recipientEmail,
    media: {
      url: mediaUrl,
      storageKey: mediaKey,
      fileName,
      mimeType,
      fileSize,
      kind: getMediaType(mimeType)
    },
    sender: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createTextMessage,
  createMediaMessage
};
