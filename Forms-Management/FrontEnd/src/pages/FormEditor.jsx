import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import TemplateRenderer from "../components/TemplateRenderer";
import PDFUploadModal from "../components/PDFUploadModal";

export default function FormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category_id, setCategoryId] = useState("");
  const [template, setTemplate] = useState("");
  const [fields, setFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);

  useEffect(() => {
    api.get("/forms/categories/list").then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get(`/forms/${id}`).then((res) => {
      const data = res.data;
      setTitle(data.title || "");
      setDescription(data.description || "");
      setCategoryId(data.category_id || "");
      setTemplate(data.template_html || "");
      setFields(
        (data.fields || []).map((f) => ({
          field_id: f.field_id,
          placeholder_no: f.placeholder_no || "",
          field_name: f.field_name || "",
          field_label: f.field_label || "",
          field_type: f.field_type || "text",
          is_required: !!f.is_required,
        }))
      );
    });
  }, [id]);

  const fieldMapByNo = useMemo(() => {
    return Object.fromEntries(
      fields
        .filter((f) => f.placeholder_no !== "" && f.placeholder_no !== null)
        .map((f) => [String(f.placeholder_no), f])
    );
  }, [fields]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { placeholder_no: "", field_name: "", field_label: "", field_type: "text", is_required: true },
    ]);
  };

  const updateField = (index, key, value) => {
    setFields((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!title) { alert("Vui lòng nhập tiêu đề"); return; }
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const payload = { title, description, category_id: category_id || null, template_html: template, created_by: user?.user_id || 1, fields };
    try {
      if (id) { await api.put(`/forms/${id}`, payload); }
      else { await api.post("/forms", payload); }
      navigate("/admin");
    } catch { alert("Lỗi khi lưu biểu mẫu"); }
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* ── Header: tiêu đề + 2 nút cạnh nhau ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>{id ? "CHỈNH SỬA BIỂU MẪU" : "TẠO BIỂU MẪU"}</h2>

        <div style={{ display: "flex", gap: 10 }}>
          {/* ✅ Nút Lưu nằm cạnh nút Tải file */}
          <button
            onClick={save}
            style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }}
          >
            {id ? "💾 Cập nhật biểu mẫu" : "💾 Lưu biểu mẫu HTML"}
          </button>

          {!id && (
            <button
              onClick={() => setIsPDFModalOpen(true)}
              style={{ padding: "10px 20px", backgroundColor: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }}
            >
              + Tải file từ máy tính
            </button>
          )}
        </div>
      </div>
      <hr />

      <table width="100%">
        <tbody>
          <tr>
            <td width="50%" valign="top">
              <p>Tiêu đề</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "95%" }} />

              <p>Mô tả</p>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "95%" }} />

              <p>Danh mục</p>
              <select value={category_id} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "95%", padding: "6px", border: "1px solid #ccc", borderRadius: "4px" }}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>

              <p>Template HTML</p>
              <textarea rows="18" value={template} onChange={(e) => setTemplate(e.target.value)} style={{ width: "95%" }} />

              <hr />
              <button onClick={addField}>+ Thêm field</button>

              {fields.map((f, i) => (
                <div key={i} style={{ backgroundColor: "#f9f9f9", padding: "10px", marginBottom: "10px", border: "1px solid #ddd" }}>
                  <p><b>Field {i + 1}</b></p>
                  <input placeholder="Placeholder No (Ví dụ: 1)" value={f.placeholder_no} onChange={(e) => updateField(i, "placeholder_no", e.target.value)} style={{ width: "95%", marginBottom: "5px" }} />
                  <input placeholder="field_name (Ví dụ: ho_ten)" value={f.field_name} onChange={(e) => updateField(i, "field_name", e.target.value)} style={{ width: "95%", marginBottom: "5px" }} />
                  <input placeholder="field_label (Ví dụ: Họ và tên)" value={f.field_label} onChange={(e) => updateField(i, "field_label", e.target.value)} style={{ width: "95%" }} />
                  <div style={{ marginTop: "5px" }}>
                    <select value={f.field_type} onChange={(e) => updateField(i, "field_type", e.target.value)}>
                      <option value="text">text</option>
                      <option value="date">date</option>
                      <option value="textarea">textarea</option>
                    </select>
                    <label style={{ marginLeft: "10px" }}>
                      <input type="checkbox" checked={f.is_required} onChange={(e) => updateField(i, "is_required", e.target.checked)} /> Bắt buộc
                    </label>
                    <button onClick={() => removeField(i)} style={{ marginLeft: "10px", color: "red" }}>Xóa field</button>
                  </div>
                </div>
              ))}
            </td>

            <td width="50%" valign="top" style={{ paddingLeft: "20px" }}>
              <p><b>Preview realtime (Chỉ cho HTML)</b></p>
              <div style={{ maxWidth: "850px", margin: "0 auto", padding: "40px", border: "1px solid #000", minHeight: "1100px", boxSizing: "border-box", background: "#fff" }}>
                <TemplateRenderer html={template || ""} values={{}} fieldMapByNo={fieldMapByNo} preview={true} />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <PDFUploadModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        onSuccess={(formId) => navigate("/admin")}
      />
    </div>
  );
}