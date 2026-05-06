import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/submissions/all")
      .then((res) => {
        setSubmissions(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh sách:", err);
        setLoading(false);
      });
  }, []);

  const handleReview = (id) => {
    navigate(`/submissions/${id}`);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Đang tải danh sách đơn nộp...
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <h2 style={styles.title}>📊 Quản lý biểu mẫu đã nhận</h2>
          <span style={styles.badge}>
            {submissions.length} đơn
          </span>
        </div>

        {/* TABLE */}
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Người nộp</th>
                <th style={styles.th}>Biểu mẫu</th>
                <th style={styles.th}>Ngày nộp</th>
                <th style={styles.th}>Hành động</th>
              </tr>
            </thead>

            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={styles.empty}>
                    Chưa có đơn nộp nào.
                  </td>
                </tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.submission_id} style={styles.row}>
                    
                    <td style={styles.td}>
                      <strong>#{s.submission_id}</strong>
                    </td>

                    <td style={styles.td}>
                      <div style={styles.name}>{s.full_name}</div>
                      <div style={styles.email}>{s.email}</div>
                    </td>

                    <td style={styles.td}>
                      <span style={styles.formTitle}>
                        {s.form_title}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {new Date(s.submitted_at).toLocaleString("vi-VN")}
                    </td>

                    <td style={styles.td}>
                      <button
                        onClick={() => handleReview(s.submission_id)}
                        style={styles.btn}
                      >
                        👁️ Review
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const styles = {
  page: {
    padding: "40px",
    backgroundColor: "#f4f6f8",
    minHeight: "100vh"
  },

  container: {
    maxWidth: "1100px",
    margin: "0 auto"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "25px"
  },

  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "600",
    color: "#333"
  },

  badge: {
    backgroundColor: "#007bff",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500"
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
    overflow: "hidden"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse"
  },

  th: {
    padding: "14px 16px",
    backgroundColor: "#343a40",
    color: "#fff",
    fontSize: "13px",
    textAlign: "left"
  },

  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #eee",
    fontSize: "14px"
  },

  row: {
    transition: "background 0.2s"
  },

  name: {
    fontWeight: "600"
  },

  email: {
    fontSize: "12px",
    color: "#777"
  },

  formTitle: {
    color: "#007bff",
    fontWeight: "500"
  },

  btn: {
    padding: "6px 12px",
    backgroundColor: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px"
  },

  empty: {
    textAlign: "center",
    padding: "25px",
    color: "#888"
  },

  loading: {
    textAlign: "center",
    padding: "50px",
    fontSize: "16px"
  }
};