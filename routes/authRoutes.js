const express = require("express");
const router = express.Router();
const { signup, login, findUserByEmail } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/lookup", authMiddleware, findUserByEmail);

module.exports = router;
