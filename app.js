const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const db = require("./models");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/user", authRoutes);
app.use("/messages", messageRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
let server;

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("exit", (code) => {
  console.log(`Node process ${process.pid} exiting with code ${code}`);
});

process.on("SIGINT", () => {
  console.log(`Received SIGINT. Shutting down server process ${process.pid}`);

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
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} with PID ${process.pid}`);
    });

    server.on("close", () => {
      console.log(`Server instance for PID ${process.pid} was closed`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });
