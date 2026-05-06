import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import TemplateRenderer from "../components/TemplateRenderer";

export default function EditSubmission() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});

  // Định nghĩa styles trực tiếp để tránh lỗi "styles is not defined"
  const styles = {
    page: { background: "#f6fcfd", minHeight: "100vh", padding: "30px", fontFamily: "Segoe UI" },
    container: { maxWidth: "1000px", margin: "auto" },
    title: { fontSize: "26px", fontWeight: "700", marginBottom: "20px", color: "#16323a" },
    card: { background: "#fff", borderRadius: "16px", padding: "25px", border: "1px solid #d7ecef", boxShadow: "0 6px 18px rgba(0,0,0,0.05)", marginBottom: "25px" },
    label: { fontWeight: "600", color: "#16323a", fontSize: "14px" },
    input: { padding: "10px", borderRadius: "8px", border: "1px solid #d7ecef", width: "100%", marginBottom: "15px" },
    sectionTitle: { fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#16323a" },
    previewArea: { border: "2px dashed #43bfc9", padding: "20px", background: "#fff", borderRadius: "12px", textAlign: "center" }
  };

  useEffect(() => {
    const cleanId = id.toString().replace(":", "");
    api.get(`/submissions/${cleanId}`)
      .then(res => {
        setSubmission(res.data);
        setFormValues(res.data.rawData || {});
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        alert("Không thể tải dữ liệu");
        setLoading(false);
      });
  }, [id]);

 const handleChange = (fieldName, value) => {
  let finalValue = value;

  // Nếu bạn muốn các ô cụ thể chỉ nhập số (ví dụ ô số 1 là ngày, ô số 2 là tháng)
  // Bạn có thể check dựa trên placeholder_no hoặc tên field
  const isDateRelated = fieldName.includes("ngay") || fieldName.includes("thang") || fieldName.includes("field_no_");

  if (isDateRelated) {
    // Chỉ cho phép nhập số
    finalValue = value.replace(/[^0-9]/g, "");
    
    // Ví dụ: Giới hạn 2 ký tự cho ngày/tháng
    if (fieldName.includes("field_no_1") || fieldName.includes("field_no_2")) {
        finalValue = finalValue.slice(0, 2);
    }
  }

  setFormValues(prev => ({
    ...prev,
    [fieldName]: finalValue
  }));
};


  const handleUpdate = async () => {
    try {
      const cleanId = id.toString().replace(":", "");
      await api.put(`/submissions/${cleanId}`, { values: formValues });
      alert("Cập nhật thành công!");
      navigate(-1); // Quay lại trang trước
    } catch (error) {
      alert("Lỗi khi cập nhật");
    }
  };

  if (loading) return <div style={styles.page}>Đang tải dữ liệu...</div>;
  if (!submission) return <div style={styles.page}>Không tìm thấy biểu mẫu.</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={styles.title}>Chỉnh sửa: {submission.info.title}</h2>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>Quay lại</button>
        </div>

        <div className="row">
          {/* CỘT TRÁI: NHẬP LIỆU */}
          <div className="col-md-5">
            <div style={styles.card}>
              <h5 style={styles.sectionTitle}>✍️ Nhập thông tin mới</h5>
              <div style={{ maxHeight: "500px", overflowY: "auto", paddingRight: "10px" }}>
                {Object.keys(formValues).map((key) => (
                  <div key={key}>
                    <label style={styles.label}>{key.replace(/_/g, ' ').toUpperCase()}</label>
                    <input
                      style={styles.input}
                      value={formValues[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <button className="btn btn-primary w-100 mb-2" style={{ background: "#43bfc9", border: "none" }} onClick={handleUpdate}>
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: XEM TRƯỚC (PREVIEW) */}
          <div className="col-md-7">
            <h5 style={styles.sectionTitle}>📄 Chỉnh sửa trực tiếp trên tài liệu</h5>
            <div style={{
              ...styles.previewArea,
              textAlign: "left",
              background: "#fff",
              padding: "40px", // Tạo cảm giác như lề giấy A4
              minHeight: "800px",
              boxShadow: "0 0 10px rgba(0,0,0,0.1)"
            }}>
              <TemplateRenderer
                html={submission.info.template_html}
                values={formValues}        // State formValues từ cột trái truyền sang
                onChange={handleChange}    // Hàm cập nhật State
                preview={false}            // Để false để hiện ô Input, không phải Text
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}