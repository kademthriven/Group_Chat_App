const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadMedia } = require("../controllers/mediaController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

router.post("/upload", authMiddleware, upload.single("media"), uploadMedia);

module.exports = router;
