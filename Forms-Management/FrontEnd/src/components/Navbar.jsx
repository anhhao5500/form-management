import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.brand}>
          <span style={styles.brandIcon}>🏠</span>
          <span style={styles.brandText}>Template library</span>
        </Link>

        <div style={styles.menu}>
          {user ? (
            <>
              {/* USER INFO */}
              <Link
                to={`/profile/${user.user_id}`}
                style={{
                  ...styles.userLink,
                  ...(isActive(`/profile/${user.user_id}`)
                    ? styles.activeLink
                    : {})
                }}
              >
                <div style={styles.avatar}>
                  {user.full_name
                    ? user.full_name.charAt(0).toUpperCase()
                    : "U"}
                </div>
                <div style={styles.userInfo}>
                  <span style={styles.userName}>
                    {user.full_name || "User"}
                  </span>
                  <span style={styles.userRole}>
                    {user.role_id === 1
                      ? "Quản trị viên"
                      : "Người dùng"}
                  </span>
                </div>
              </Link>

              {/* ADMIN */}
              {user.role_id === 1 && (
                <Link
                  to="/admin"
                  style={{
                    ...styles.pillButton,
                    ...(isActive("/admin")
                      ? styles.pillButtonActive
                      : {})
                  }}
                >
                  Quản trị
                </Link>
              )}

              {/* LOGOUT */}
              <button onClick={handleLogout} style={styles.logoutButton}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              {/* LOGIN */}
              <Link to="/login" style={styles.loginButton}>
                Đăng nhập
              </Link>

              {/* REGISTER */}
              <Link to="/register" style={styles.registerButton}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #d7ecef",
    boxShadow: "0 6px 24px rgba(67, 191, 201, 0.06)"
  },

  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px"
  },

  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    color: "#16323a",
    fontWeight: "800",
    fontSize: "18px"
  },

  brandIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #43bfc9, #7fd7df)",
    boxShadow: "0 10px 24px rgba(67, 191, 201, 0.18)"
  },

  brandText: {
    lineHeight: 1
  },

  menu: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap"
  },

  userLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    color: "#16323a",
    padding: "8px 12px",
    borderRadius: "14px",
    border: "1px solid transparent",
    transition: "all 0.2s ease"
  },

  activeLink: {
    background: "#e5f8fa",
    borderColor: "#b9e9ee"
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #43bfc9, #7fd7df)",
    color: "#fff",
    fontWeight: "800"
  },

  userInfo: {
    display: "flex",
    flexDirection: "column"
  },

  userName: {
    fontWeight: "700",
    fontSize: "14px"
  },

  userRole: {
    fontSize: "12px",
    color: "#6a7f86"
  },

  pillButton: {
    textDecoration: "none",
    color: "#43bfc9",
    border: "1px solid #43bfc9",
    padding: "9px 14px",
    borderRadius: "999px",
    fontWeight: "700"
  },

  pillButtonActive: {
    background: "#e5f8fa"
  },

  logoutButton: {
    padding: "9px 14px",
    background: "#ff6f7b",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    cursor: "pointer",
    fontWeight: "700"
  },

  loginButton: {
    textDecoration: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #43bfc9, #7fd7df)",
    padding: "9px 16px",
    borderRadius: "999px",
    fontWeight: "700"
  },

  registerButton: {
    textDecoration: "none",
    color: "#43bfc9",
    background: "#fff",
    border: "1px solid #43bfc9",
    padding: "9px 16px",
    borderRadius: "999px",
    fontWeight: "700"
  }
};