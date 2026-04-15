const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  listGroups,
  createGroup,
  joinGroup,
  getGroupMessages
} = require("../controllers/groupController");

const router = express.Router();

router.get("/", authMiddleware, listGroups);
router.post("/", authMiddleware, createGroup);
router.post("/join", authMiddleware, joinGroup);
router.get("/:groupId/messages", authMiddleware, getGroupMessages);

module.exports = router;
