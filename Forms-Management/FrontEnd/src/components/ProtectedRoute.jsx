import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // Nếu không có token -> Đá về login
  if (!token) {
    console.warn("ProtectedRoute: Không tìm thấy token, điều hướng về /login");
    return <Navigate to="/login" />;
  }

  // Nếu yêu cầu quyền Admin mà user không phải admin
  if (adminOnly && user?.role_id !== 1) {
    console.warn("ProtectedRoute: Từ chối truy cập vì không phải Admin");
    return <h3 style={{ padding: "20px", textAlign: "center" }}>Không có quyền truy cập trang quản trị</h3>;
  }

  return children;
}