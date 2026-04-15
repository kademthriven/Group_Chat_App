const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const archiveRoutes = require("./routes/archiveRoutes");
const groupRoutes = require("./routes/groupRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const messageRoutes = require("./routes/messageRoutes");
const initializeSocketServer = require("./socket-io");
const createChatArchiveService = require("./services/chatArchiveService");
const createGroupChatService = require("./services/groupChatService");
const createS3MediaService = require("./services/s3MediaService");
const db = require("./models");

const app = express();
const httpServer = http.createServer(app);
app.locals.groupChatService = createGroupChatService();
app.locals.s3MediaService = createS3MediaService();
app.locals.persistGeneralMessage = async ({ userId, message }) => {
  const createdMessage = await db.Message.create({
    userId,
    message
  });

  const savedMessage = await db.Message.findByPk(createdMessage.id, {
    include: [
      {
        model: db.User,
        as: "sender",
        attributes: ["id", "name", "email"]
      }
    ]
  });

  return savedMessage.toJSON();
};
app.locals.chatArchiveService = createChatArchiveService({
  sequelize: db.sequelize,
  Message: db.Message,
  ArchivedChat: db.ArchivedChat
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/user", authRoutes);
app.use("/archive", archiveRoutes);
app.use("/groups", groupRoutes);
app.use("/media", mediaRoutes);
app.use("/messages", messageRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
let server;
const io = initializeSocketServer(httpServer, app);
let archiveCronTask;

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

  archiveCronTask?.stop();
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
    archiveCronTask = cron.schedule("0 0 * * *", async () => {
      try {
        const result = await app.locals.chatArchiveService.archiveOldMessages();
        console.log(`Nightly archive completed. Archived ${result.archivedCount} message(s).`);
      } catch (error) {
        console.error("Nightly archive failed:", error);
      }
    }, {
      timezone: process.env.CRON_TIMEZONE || "America/Los_Angeles"
    });

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
