import React, { useState } from "react";
import api from "../api";

export default function PDFUploadModal({ isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setError("");
    if (!selected) return;

    const ext = selected.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      setError("❌ Chỉ hỗ trợ file PDF (.pdf) hoặc Word (.docx, .doc).");
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) return alert("Vui lòng nhập tiêu đề và chọn file");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("pdf", file); // key vẫn là "pdf" cho backend

    setLoading(true);
    try {
      const res = await api.post("/forms/upload-pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`Tải lên thành công! Phát hiện ${res.data.fields_detected || 0} trường dữ liệu.`);
      onSuccess(res.data.form_id);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Có lỗi xảy ra khi tải file lên.");
    } finally {
      setLoading(false);
    }
  };

  // Reset khi đóng
  const handleClose = () => {
    setTitle("");
    setFile(null);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  const ext = file ? file.name.split(".").pop().toLowerCase() : "";
  const fileIcon = ext === "pdf" ? "📄" : "📝";

  return (
    <div style={S.overlay}>
      <div style={S.container}>
        <h3 style={{ marginTop: 0, marginBottom: 20, color: "#333" }}>
          📎 Tải lên Biểu mẫu
        </h3>

        <div style={S.field}>
          <label style={S.label}>
            Tiêu đề biểu mẫu <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            style={S.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Tờ trình chuyển đổi..."
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>
            Chọn file <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={handleFileChange}
            style={S.input}
          />

          {file && !error && (
            <div style={S.fileChip}>
              {fileIcon} {file.name}
            </div>
          )}

          {error && <div style={S.errorBox}>{error}</div>}
        </div>

        {/* Hướng dẫn */}
        <div style={S.infoBox}>
          <b>✅ Hỗ trợ:</b>
          <ul style={{ margin: "4px 0 4px 16px", padding: 0 }}>
            <li>📄 PDF có text (<i>copy được chữ</i>) — hệ thống tự nhận diện ô trống</li>
            <li>📝 Word (.docx, .doc) — giữ layout tốt nhất</li>
          </ul>
          <span style={{ color: "#888", fontSize: 11 }}>
            ❌ PDF scan (ảnh) không được hỗ trợ.
          </span>
        </div>

        <div style={S.actions}>
          <button onClick={handleClose} disabled={loading} style={S.cancelBtn}>
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !!error || !file || !title}
            style={{
              ...S.submitBtn,
              opacity: loading || !!error || !file || !title ? 0.6 : 1,
              cursor: loading || !!error || !file || !title ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "⏳ Đang xử lý..." : "⬆️ Tải lên & Tiếp tục"}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: 1000,
  },
  container: {
    backgroundColor: "white", padding: 24, borderRadius: 10,
    width: 460, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  },
  field: { marginBottom: 16 },
  label: { display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14, color: "#333" },
  input: { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" },
  fileChip: {
    marginTop: 8, padding: "6px 10px", borderRadius: 6,
    fontSize: 12, background: "#e3f2fd", color: "#1565c0",
    border: "1px solid #90caf9",
  },
  errorBox: {
    marginTop: 8, padding: "8px 12px", borderRadius: 6,
    fontSize: 13, background: "#fdecea", color: "#c62828",
    border: "1px solid #ef9a9a",
  },
  infoBox: {
    padding: 12, backgroundColor: "#f0f7ff", borderRadius: 6,
    fontSize: 12, color: "#555", marginBottom: 16, lineHeight: 1.8,
  },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancelBtn: {
    padding: "8px 16px", borderRadius: 6,
    border: "1px solid #ccc", cursor: "pointer", background: "#fff",
  },
  submitBtn: {
    backgroundColor: "#28a745", color: "white",
    border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 600,
  },
};