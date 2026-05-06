import { useState } from "react";
import api from "../api";
import { useNavigate, Link } from "react-router-dom"; // Thêm Link từ react-router-dom

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { email, password });

      if (res.data && res.data.user) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate(`/profile/${res.data.user.user_id}`);
      }
    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      alert(err.response?.data?.message || "Đăng nhập thất bại!");
    }
  };

  // Style đồng bộ với tone màu bạn chọn
  const styles = {
    container: { display: "flex", justifyContent: "center", marginTop: "100px", fontFamily: "Segoe UI" },
    card: { 
      width: "350px", padding: "30px", background: "#fff", 
      borderRadius: "16px", border: "1px solid #d7ecef",
      boxShadow: "0 10px 25px rgba(67,191,201,0.1)" 
    },
    title: { textAlign: "center", marginBottom: "25px", color: "#16323a", fontWeight: "700" },
    input: { width: "100%", padding: "12px", marginBottom: "15px", borderRadius: "10px", border: "1px solid #d7ecef", boxSizing: "border-box", outline: "none" },
    button: { width: "100%", padding: "12px", background: "#43bfc9", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "700", transition: "0.3s" },
    footer: { marginTop: "20px", textAlign: "center", fontSize: "14px", color: "#6a7f86" },
    link: { color: "#43bfc9", textDecoration: "none", fontWeight: "600" }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h3 style={styles.title}>Đăng nhập hệ thống</h3>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={styles.input}
          required
        />
        <button type="submit" style={styles.button}>
          Đăng nhập ngay
        </button>

        

        {/* PHẦN THÊM MỚI THEO Ý BẠN */}
        <div style={styles.footer}>
          <span>You don't have an account? </span>
          <Link to="/register" style={styles.link}>Register here</Link>
        </div>
      </form>
    </div>
  );
}