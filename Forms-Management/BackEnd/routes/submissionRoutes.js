const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submissionController");

// ================= USER =================
router.post("/",                    submissionController.submitForm);
router.get("/user/:userId",         submissionController.getUserHistory);
router.put("/:id",                  submissionController.updateSubmission);

// ================= ADMIN =================
router.get("/all",                  submissionController.getAllSubmissions);
router.get("/export/:id",           submissionController.exportPDF);

// ================= VIEW HISTORY (trước /:id) =================
router.get("/:id/viewer-history",   submissionController.getViewerHistory);
router.delete("/:id/viewer-history",submissionController.clearViewerHistory);

// ================= DETAIL & DELETE (cuối cùng) =================
router.get("/:id",                  submissionController.getSubmissionDetail);
router.delete("/:id",               submissionController.deleteSubmission); 
module.exports = router;