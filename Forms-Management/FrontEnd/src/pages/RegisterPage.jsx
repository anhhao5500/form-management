import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Kiểm tra mật khẩu khớp nhau
    if (formData.password !== formData.confirmPassword) {
      return setError("Mật khẩu xác nhận không khớp!");
    }

    setLoading(true);
    try {
      // Thay đổi URL API cho đúng với project của bạn (thường là /api/users/register)
      await axios.post("http://localhost:5000/api/users/register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      alert("Đăng ký thành công!");
      navigate("/login"); // Chuyển hướng sang trang đăng nhập
    } catch (err) {
      setError(err.response?.data?.message || "Đã xảy ra lỗi khi đăng ký.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container" style={styles.container}>
      <div className="register-card" style={styles.card}>
        <h2 style={styles.title}>Đăng ký tài khoản</h2>
        {error && <p style={styles.error}>{error}</p>}
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label>Tên đăng nhập:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label>Mật khẩu:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label>Xác nhận mật khẩu:</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Đang xử lý..." : "Đăng ký"}
          </button>
        </form>

        <p style={styles.footer}>
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
};

// Style cơ bản để trang trông chuyên nghiệp ngay lập tức
const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f7f6" },
  card: { padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", backgroundColor: "#fff", width: "100%", maxWidth: "400px" },
  title: { textAlign: "center", marginBottom: "1.5rem", color: "#333" },
  form: { display: "flex", flexDirection: "column" },
  inputGroup: { marginBottom: "1rem", display: "flex", flexDirection: "column" },
  input: { padding: "10px", borderRadius: "4px", border: "1px solid #ddd", marginTop: "5px" },
  button: { padding: "12px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", marginTop: "10px", fontWeight: "bold" },
  error: { color: "red", fontSize: "14px", textAlign: "center", marginBottom: "10px" },
  footer: { textAlign: "center", marginTop: "1rem", fontSize: "14px" }
};

export default RegisterPage;