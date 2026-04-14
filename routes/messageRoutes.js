const express = require("express");
const { createMessage, getMessages } = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getMessages);
router.post("/", authMiddleware, createMessage);

module.exports = router;
