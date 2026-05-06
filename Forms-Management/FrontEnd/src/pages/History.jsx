import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function History() {
  const [submissions, setSubmissions] = useState([]);
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");

  useEffect(() => {
    if (userId) {
      api.get(`/submissions/user/${userId}`)
        .then(res => setSubmissions(res.data))
        .catch(err => console.error("Lỗi tải lịch sử:", err));
    }
  }, [userId]);

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá biểu mẫu này không?")) return;
    try {
      await api.delete(`/submissions/${id}`);
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const uid = user?.user_id;
      navigate(uid ? `/profile/${uid}` : "/");
    } catch {
      alert("Lỗi khi xoá biểu mẫu.");
    }
  };

  return (
    <div className="container" style={{ padding: "30px", maxWidth: "1000px", margin: "auto" }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>📝 Lịch sử nộp biểu mẫu</h3>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/")}>
          Quay lại trang chủ
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <table className="table table-hover mt-2">
            <thead className="table-light">
              <tr>
                <th>Tên biểu mẫu</th>
                <th>Ngày nộp</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length > 0 ? (
                submissions.map(s => (
                  <tr key={s.submission_id}>
                    <td className="align-middle fw-bold">{s.form_title}</td>
                    <td className="align-middle">{new Date(s.submitted_at).toLocaleString("vi-VN")}</td>
                    <td className="text-center">
                      <div className="d-flex gap-2 justify-content-center">
                        <button
                          className="btn btn-info btn-sm text-white"
                          onClick={() => navigate(`/submissions/${s.submission_id}`)}
                        >
                          👁️ Xem & Sửa & In
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(s.submission_id)}
                        >
                          🗑️ Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center py-4 text-muted">
                    Bạn chưa nộp biểu mẫu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}