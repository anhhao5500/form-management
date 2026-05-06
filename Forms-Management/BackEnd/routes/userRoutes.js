const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// ── Profile ──
router.get("/profile/:id",  userController.getUserProfile);
router.put("/profile/:id",  userController.updateOwnProfile);

// ── Personal Forms (phân trang + tìm kiếm) ──
router.get("/:userId/personal-forms", userController.getPersonalForms);

// ── Log tương tác ──
router.post("/interactions",  userController.logInteraction);

// ── Admin ──
router.get("/",           userController.getAllUsers);
router.post("/",          userController.createUser);
router.put("/:id",        userController.updateUser);
router.delete("/:id",     userController.deleteUser);

module.exports = router;