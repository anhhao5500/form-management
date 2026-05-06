import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ user: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ phone: "", dob: "", address: "" });

  useEffect(() => {
    api.get(`/users/profile/${id}`)
      .then(res => {
        setData(res.data);
        setEditForm({
          phone: res.data.user.phone || "",
          dob: res.data.user.dob ? res.data.user.dob.split("T")[0] : "",
          address: res.data.user.address || ""
        });
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdate = async () => {
    try {
      const res = await api.put(`/users/profile/${id.toString().replace(":", "")}`, editForm);
      alert("Cập nhật thành công!");
      setIsEditing(false);

      const updatedUser = res.data?.user || editForm;
      setData(prev => ({ ...prev, user: { ...prev.user, ...updatedUser } }));

      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      if (currentUser) {
        localStorage.setItem("user", JSON.stringify({ ...currentUser, ...updatedUser }));
      }
    } catch {
      alert("Lỗi cập nhật");
    }
  };

  if (loading) return <div style={S.page}>Đang tải...</div>;
  if (!data.user) return <div style={S.page}>Không tìm thấy người dùng.</div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h2 style={S.title}>Thông tin: {data.user.full_name}</h2>

        <div style={S.card}>
          <div style={S.row}>
            <span style={S.label}>Email: </span>
            <span>{data.user.email}</span>
          </div>

          {isEditing ? (
            <>
              {[
                ["Số điện thoại", "phone", "text"],
                ["Ngày sinh", "dob", "date"],
                ["Địa chỉ", "address", "text"]
              ].map(([lbl, key, type]) => (
                <div key={key} style={S.inputGroup}>
                  <label style={S.label}>{lbl}</label>
                  <input
                    type={type}
                    style={S.input}
                    value={editForm[key]}
                    onChange={e => {
                      let value = e.target.value;

                      if (key === "phone") {
                        value = value.replace(/\D/g, "");
                      }

                      setEditForm({
                        ...editForm,
                        [key]: value
                      });
                    }}
                  />
                </div>
              ))}

              <button style={S.btnPrimary} onClick={handleUpdate}>Lưu</button>
              <button style={S.btnSecondary} onClick={() => setIsEditing(false)}>Hủy</button>
            </>
          ) : (
            <>
              <div style={S.row}>
                <span style={S.label}>SĐT: </span>
                <span>{data.user.phone || "Chưa cập nhật"}</span>
              </div>
              <div style={S.row}>
                <span style={S.label}>Ngày sinh: </span>
                <span>{data.user.dob ? new Date(data.user.dob).toLocaleDateString("vi-VN") : "Chưa cập nhật"}</span>
              </div>
              <div style={S.row}>
                <span style={S.label}>Địa chỉ: </span>
                <span>{data.user.address || "Chưa cập nhật"}</span>
              </div>
              <button style={S.btnPrimary} onClick={() => setIsEditing(true)}>Chỉnh sửa thông tin</button>
            </>
          )}
        </div>

        <h3 style={S.sectionTitle}>Personal Forms</h3>
        <p style={S.sectionDescription}>
          Delete form, save/print PDF
        </p>

        {data.history?.length > 0 ? data.history.map(h => (
          <div key={h.submission_id} style={S.historyItem}>
            <div>
              <div style={{ fontWeight: 600, color: "#16323a" }}>{h.form_title}</div>
              <div style={S.date}>Ngày nộp: {new Date(h.submitted_at).toLocaleDateString("vi-VN")}</div>
            </div>
            <button style={S.btnView} onClick={() => navigate(`/submissions/${h.submission_id}`)}>
              👁️ Xem & Sửa & In
            </button>
          </div>
        )) : (
          <div style={S.empty}>Chưa có lịch sử nộp biểu mẫu</div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { background: "#f6fcfd", minHeight: "100vh", padding: "30px", fontFamily: "Segoe UI" },
  container: { maxWidth: "900px", margin: "auto" },
  title: { fontSize: "26px", fontWeight: "700", marginBottom: "20px", color: "#16323a" },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #d7ecef",
    boxShadow: "0 6px 18px rgba(67,191,201,0.08)",
    marginBottom: "25px"
  },
  row: { marginBottom: "10px" },
  label: { fontWeight: "600", color: "#16323a", marginRight: 6 },
  inputGroup: { marginBottom: "12px" },
  input: { padding: "8px 10px", borderRadius: "8px", border: "1px solid #d7ecef", width: "100%" },
  btnPrimary: {
    background: "#43bfc9",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    marginRight: "10px"
  },
  btnSecondary: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer"
  },
  sectionTitle: { fontSize: "20px", fontWeight: "600", marginBottom: "15px", color: "#16323a" },
  sectionDescription: { fontSize: "13px", color: "#8fa3a8", marginBottom: "15px", marginTop: "-10px" },
  historyItem: {
    padding: "15px 20px",
    borderRadius: "12px",
    border: "1px solid #d7ecef",
    background: "#fff",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
  },
  date: { fontSize: "12px", color: "#8fa3a8" },
  btnView: {
    background: "#e0f7f8",
    color: "#008b8b",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: "600"
  },
  empty: { color: "#aaa", textAlign: "center", padding: "20px" }
};