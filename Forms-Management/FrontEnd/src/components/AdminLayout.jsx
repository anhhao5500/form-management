import { Link, useLocation } from "react-router-dom";

export default function AdminLayout({ children }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const styles = {
    layout: { display: "flex", minHeight: "100vh", background: "#f6fcfd" },
    sidebar: { width: "250px", background: "#fff", borderRight: "1px solid #d7ecef", padding: "20px", position: "fixed", height: "100vh" },
    content: { flex: 1, marginLeft: "250px", padding: "30px" },
    navItem: (active) => ({
      display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "10px",
      textDecoration: "none", marginBottom: "5px", transition: "0.2s",
      color: active ? "#43bfc9" : "#555",
      background: active ? "#e5f8fa" : "transparent",
      fontWeight: active ? "600" : "500"
    })
  };

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <h3 style={{ color: "#16323a", marginBottom: "25px", paddingLeft: "12px" }}>ADMIN</h3>
        
        <Link to="/admin" style={styles.navItem(isActive("/admin"))}>
          📄 Quản lý biểu mẫu
        </Link>

        <Link to="/admin/submissions" style={styles.navItem(isActive("/admin/submissions"))}>
          📥 Đơn đã nộp
        </Link>

        <Link to="/admin/users" style={styles.navItem(isActive("/admin/users"))}>
          👤 Quản lý người dùng
        </Link>

        <hr style={{ border: "0", borderTop: "1px solid #eee", margin: "20px 0" }} />

        <Link to="/" style={styles.navItem(false)}>
          🏠 Trang người dùng
        </Link>
      </div>

      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
}