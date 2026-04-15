const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { runArchiveJob } = require("../controllers/archiveController");

const router = express.Router();

router.post("/run", authMiddleware, runArchiveJob);

module.exports = router;
