const jwt = require("jsonwebtoken");
const { User } = require("../models");

function getSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;

  if (authToken) {
    return authToken;
  }

  const header = socket.handshake.headers?.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }

  return null;
}

async function socketAuth(socket, next) {
  const token = getSocketToken(socket);

  if (!token) {
    next(new Error("Authentication token is required"));
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "name", "email", "phone"]
    });

    if (!user) {
      next(new Error("User not found"));
      return;
    }

    socket.user = user.toJSON();
    socket.data.user = socket.user;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
}

module.exports = {
  socketAuth
};
