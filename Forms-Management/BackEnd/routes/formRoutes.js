const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const formController = require("../controllers/formController");
const { verifyToken } = require("../middleware/auth");
const { isAdmin } = require("../middleware/role");

// ── Multer config: chấp nhận PDF + Word ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/msword", // .doc
  ];
  const allowedExts = [".pdf", ".docx", ".doc"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ file PDF hoặc Word (.docx, .doc)!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── Routes ──

// 1. Danh sách biểu mẫu
router.get("/", formController.getForms);

// 2. Categories (phải đặt TRÊN /:id)
router.get("/categories/list", formController.getCategories);

// 3. Chi tiết biểu mẫu
router.get("/:id", formController.getFormDetail);

// 4. Tạo bằng HTML
router.post("/", verifyToken, isAdmin, formController.createForm);

// 5. Upload PDF / DOCX / DOC → convert → HTML có ô điền
router.post(
  "/upload-pdf",
  verifyToken,
  isAdmin,
  upload.single("pdf"),
  formController.createFormPDF
);

// 6. Cập nhật tọa độ field
router.put("/:id/coords", verifyToken, isAdmin, formController.updateFieldCoords);

// 7. Cập nhật thông tin form
router.put("/:id", verifyToken, isAdmin, formController.updateForm);

// 8. Xóa form
router.delete("/:id", verifyToken, isAdmin, formController.deleteForm);

module.exports = router;