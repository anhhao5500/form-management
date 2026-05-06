import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AdminPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadForms = async () => {
    try {
      setLoading(true);
      const res = await api.get("/forms");
      setForms(res.data || []);
    } catch (error) {
      console.error("Load forms failed:", error);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadForms(); }, []);

  const deleteForm = async (id) => {
    if (!window.confirm("Xóa biểu mẫu này?")) return;
    try {
      await api.delete(`/forms/${id}`);
      loadForms();
    } catch {
      alert("Không thể xóa biểu mẫu.");
    }
  };

  return (
    <div className="admin-page">
      <style>{`
        .admin-page {
          min-height: 100vh;
          padding: 32px;
          background:
            radial-gradient(circle at top left, rgba(67,191,201,0.16), transparent 28%),
            radial-gradient(circle at top right, rgba(124,58,237,0.12), transparent 24%),
            linear-gradient(180deg, #f7fbfc 0%, #eef6f8 100%);
        }
        .page-shell { max-width: 1280px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .title-wrap h1 { margin: 0; font-size: 30px; font-weight: 800; color: #12323a; letter-spacing: -0.02em; }
        .title-wrap p { margin: 8px 0 0; color: #5b6b73; font-size: 14px; }
        .create-btn {
          padding: 12px 18px; border: none; border-radius: 14px;
          background: linear-gradient(135deg, #43bfc9, #7fd7df);
          color: #fff; font-weight: 700; cursor: pointer;
          box-shadow: 0 12px 30px rgba(67,191,201,0.28);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .create-btn:hover { transform: translateY(-1px); box-shadow: 0 16px 36px rgba(67,191,201,0.34); }
        .card { background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border: 1px solid rgba(215,236,239,0.95); border-radius: 20px; box-shadow: 0 18px 45px rgba(15,23,42,0.08); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 760px; }
        thead th { text-align: left; padding: 16px 18px; background: linear-gradient(180deg,#f3fbfc,#edf8f9); color: #16323a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #d7ecef; white-space: nowrap; }
        tbody td { padding: 16px 18px; border-bottom: 1px solid #edf2f4; color: #22343b; vertical-align: middle; }
        tbody tr { transition: background 0.18s ease; }
        tbody tr:hover { background: #f8fcfd; }
        .index-badge { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 999px; background: #eef8fa; color: #2c7480; font-weight: 700; }
        .type-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; line-height: 1; }
        .type-pdf { background: #fff3e8; color: #e65100; }
        .type-doc { background: #eaf3ff; color: #1565c0; }
        .date-text { color: #51636a; font-size: 14px; }
        .action-group { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn { padding: 8px 12px; border-radius: 10px; border: 1px solid #d4e6ea; background: #fff; color: #23414a; cursor: pointer; font-size: 13px; font-weight: 600; transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(15,23,42,0.08); background: #f9fcfd; }
        .btn-danger { background: linear-gradient(135deg,#ff7582,#ff5f6d); color: #fff; border: none; box-shadow: 0 10px 22px rgba(255,95,109,0.28); }
        .btn-danger:hover { background: linear-gradient(135deg,#ff6b79,#ff4f60); }
        .empty { text-align: center; padding: 28px 18px; color: #7a8a91; }
        .loading-row { text-align: center; padding: 28px 18px; color: #5b6b73; }
        .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .stat-card { min-width: 180px; padding: 16px 18px; border-radius: 18px; background: rgba(255,255,255,0.88); border: 1px solid rgba(215,236,239,0.95); box-shadow: 0 12px 28px rgba(15,23,42,0.05); }
        .stat-label { font-size: 13px; color: #6a7a80; margin-bottom: 8px; }
        .stat-value { font-size: 24px; font-weight: 800; color: #12323a; letter-spacing: -0.02em; }
        @media (max-width: 768px) {
          .admin-page { padding: 18px; }
          .title-wrap h1 { font-size: 24px; }
          thead th, tbody td { padding: 14px 12px; }
        }
      `}</style>

      <div className="page-shell">
        <div className="page-header">
          <div className="title-wrap">
            <h1>Danh sách biểu mẫu</h1>
            <p>Quản lý, chỉnh sửa các biểu mẫu trong hệ thống.</p>
          </div>
          <button className="create-btn" onClick={() => navigate("/admin/create")}>
            + Tạo biểu mẫu
          </button>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Tổng biểu mẫu</div>
            <div className="stat-value">{forms.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tiêu đề</th>
                  <th>Loại</th>
                  <th>Ngày tạo</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="loading-row">Đang tải dữ liệu...</td></tr>
                ) : forms.length === 0 ? (
                  <tr><td colSpan="5" className="empty">Không có dữ liệu</td></tr>
                ) : (
                  forms.map((f, index) => (
                    <tr key={f.form_id}>
                      <td><span className="index-badge">{index + 1}</span></td>
                      <td><strong>{f.title}</strong></td>
                      <td>
                        {f.template_pdf
                          ? <span className="type-chip type-pdf">📄 PDF</span>
                          : <span className="type-chip type-doc">📝 Word / HTML</span>}
                      </td>
                      <td className="date-text">
                        {f.created_at ? new Date(f.created_at).toLocaleDateString("vi-VN") : "-"}
                      </td>
                      <td>
                        <div className="action-group">
                          <button className="btn" onClick={() => navigate(`/admin/edit/${f.form_id}`)}>Sửa</button>
                          <button className="btn btn-danger" onClick={() => deleteForm(f.form_id)}>Xóa</button>
                          <button className="btn" onClick={() => navigate(`/form/${f.form_id}`)}>Xem</button>
                          {/* ✅ Bỏ nút Cấu hình */}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}