import { useEffect, useMemo, useState } from "react";
import api from "../api";
// ❌ Xóa import AdminLayout vì nó đã được bọc ở Route cha

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role_id: 2 });

  const pageSize = 5;

  const loadUsers = async () => {
    const res = await api.get("/users");
    setUsers(res.data || []);
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [users, currentPage]);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, currentPage]);

  const resetForm = () => {
    setForm({ full_name: "", email: "", password: "", role_id: 2 });
    setEditingId(null);
  };

  const handleOpenAdd = () => { resetForm(); setShowForm(true); };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      alert("Nhập đầy đủ họ tên và email");
      return;
    }
    try {
      const payload = { ...form, role_id: Number(form.role_id) };
      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        if (!payload.password) return alert("Vui lòng nhập password");
        await api.post("/users", payload);
      }
      await loadUsers();
      resetForm();
      setShowForm(false);
    } catch (err) {
      alert(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const handleEdit = (u) => {
    setForm({ full_name: u.full_name || "", email: u.email || "", password: "", role_id: u.role_id || 2 });
    setEditingId(u.user_id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa user này?")) return;
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
    } catch (err) {
      alert(err?.response?.data?.message || "Xóa thất bại");
    }
  };

  const styles = {
    // 💡 Xóa minHeight: 100vh và background ở đây để không bị đè lên Layout chung
    container: { fontFamily: "Segoe UI", padding: "10px" }, 
    grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px", alignItems: "start" },
    card: { 
        background: "#fff", borderRadius: "18px", padding: "20px", border: "1px solid #d7ecef",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)" 
    },
    pageTitle: { fontSize: "28px", fontWeight: "800", color: "#16323a", marginBottom: "20px" },
    input: { width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "10px", border: "1px solid #d7ecef", outline: "none" },
    buttonPrimary: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #43bfc9, #7fd7df)", color: "#fff", fontWeight: "700", cursor: "pointer" },
    userItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "12px", border: "1px solid #f0f0f0", marginBottom: "10px" },
    badge: (role) => ({ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", background: role === 1 ? "#ff6f7b" : "#e5f8fa", color: role === 1 ? "#fff" : "#43bfc9" }),
    pagination: { display: "flex", justifyContent: "center", gap: "5px", marginTop: "20px" },
    pageBtn: (active) => ({ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d7ecef", background: active ? "#43bfc9" : "#fff", color: active ? "#fff" : "#333", cursor: "pointer" })
  };

  return (
    // ✅ Bỏ AdminLayout ở đây
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>QUẢN LÝ NGƯỜI DÙNG</h1>

      <div style={styles.grid}>
        {/* FORM NHẬP LIỆU */}
        <div style={styles.card}>
          <h3 style={{ marginBottom: "15px" }}>{editingId ? "Sửa người dùng" : "Thêm người dùng"}</h3>
          <button onClick={handleOpenAdd} style={{ ...styles.buttonPrimary, marginBottom: "15px", background: "#16323a" }}>+ Thêm mới</button>
          
          {showForm && (
            <>
              <input style={styles.input} placeholder="Họ tên" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <input style={styles.input} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input style={styles.input} placeholder="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select style={styles.input} value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                <option value={2}>User</option>
                <option value={1}>Admin</option>
              </select>
              <button style={styles.buttonPrimary} onClick={handleSubmit}>{editingId ? "Cập nhật" : "Tạo ngay"}</button>
            </>
          )}
        </div>

        {/* DANH SÁCH USER */}
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
             <span style={{ fontWeight: "700" }}>Danh sách hệ thống</span>
             <span>Tổng: <b>{users.length}</b></span>
          </div>

          {pagedUsers.map((u) => (
            <div key={u.user_id} style={styles.userItem}>
              <div>
                <div style={{ fontWeight: "700" }}>{u.full_name}</div>
                <div style={{ fontSize: "13px", color: "#666" }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={styles.badge(u.role_id)}>{u.role_id === 1 ? "Admin" : "User"}</span>
                <button onClick={() => handleEdit(u)} style={{ border: "none", background: "none", color: "#43bfc9", cursor: "pointer" }}>Sửa</button>
                <button onClick={() => handleDelete(u.user_id)} style={{ border: "none", background: "none", color: "#ff6f7b", cursor: "pointer" }}>Xóa</button>
              </div>
            </div>
          ))}

          {/* Phân trang */}
          <div style={styles.pagination}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} style={styles.pageBtn(p === currentPage)} onClick={() => setCurrentPage(p)}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}