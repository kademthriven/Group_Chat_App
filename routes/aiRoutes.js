const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getSuggestions } = require("../controllers/aiController");

const router = express.Router();

router.post("/suggestions", authMiddleware, getSuggestions);

module.exports = router;
