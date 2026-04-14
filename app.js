const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const db = require("./models");
const { Message, User } = db;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function persistMessage({ userId, message }) {
  const trimmedMessage = message?.trim();

  if (!trimmedMessage) {
    throw new Error("Message is required");
  }

  const newMessage = await Message.create({
    userId,
    message: trimmedMessage
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

  return savedMessage.toJSON();
}

app.locals.broadcastMessage = (message) => {
  io.emit("message:created", {
    payload: message
  });
};

app.locals.persistMessage = persistMessage;

app.use(express.static(path.join(__dirname, "public")));
app.use("/user", authRoutes);
app.use("/messages", messageRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
let server;

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    next(new Error("Authentication token is required"));
    return;
  }

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const { user } = socket;

  console.log(`Socket connected for user ${user.id}`);

  socket.emit("connection.ready", {
    userId: user.id
  });

  socket.on("message:create", async (payload = {}, callback) => {
    try {
      const savedMessage = await persistMessage({
        userId: user.id,
        message: payload.message
      });

      app.locals.broadcastMessage(savedMessage);
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

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected for user ${user.id}: ${reason}`);
  });

  socket.on("error", (error) => {
    console.error("Socket.IO error:", error);
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Don't exit on uncaught exception
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  // Don't exit on unhandled rejection
});

process.on("exit", (code) => {
  console.log(`Node process ${process.pid} exiting with code ${code}`);
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).json({ error: "Internal server error" });
});

process.on("SIGINT", () => {
  console.log(`Received SIGINT. Shutting down server process ${process.pid}`);

  io.close();

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    return;
  }

  process.exit(0);
});

db.sequelize
  .authenticate()
  .then(() => {
    console.log(`Database connected successfully for process ${process.pid}`);
    server = httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} with PID ${process.pid}`);
    });

    server.on("close", () => {
      console.log(`Server instance for PID ${process.pid} was closed`);
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    // Don't exit - retry or keep app running
    setTimeout(() => {
      console.log("Retrying database connection...");
      process.exit(1);
    }, 5000);
  });
