import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import PDFUploadModal from "../components/PDFUploadModal";

// ── Chuyển HTML gốc (có input/textarea) → contenteditable spans ──
function convertToEditable(html) {
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("input[type='text'], input:not([type])").forEach((el) => {
    const span = doc.createElement("span");
    span.setAttribute("contenteditable", "true");
    span.setAttribute("data-field", el.getAttribute("name") || "");
    span.style.cssText =
      "border-bottom:1px solid #333;display:inline-block;min-width:80px;" +
      "outline:none;font-family:inherit;font-size:inherit;line-height:inherit;" +
      "background:transparent;cursor:text;";
    span.textContent = el.getAttribute("value") || "";
    el.parentNode.replaceChild(span, el);
  });

  doc.querySelectorAll("textarea").forEach((el) => {
    const div = doc.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.setAttribute("data-field", el.getAttribute("name") || "");
    div.style.cssText =
      "border-bottom:1px solid #333;display:block;min-width:200px;min-height:1.5em;" +
      "width:100%;outline:none;font-family:inherit;font-size:inherit;line-height:inherit;" +
      "background:transparent;cursor:text;";
    div.textContent = el.textContent || "";
    el.parentNode.replaceChild(div, el);
  });

  const wordDoc = doc.querySelector(".word-document");
  return wordDoc ? wordDoc.innerHTML : doc.body.innerHTML;
}

// ── Chuyển ngược span/div[data-field] → input/textarea để lưu ──
function convertBackToForm(editorEl) {
  if (!editorEl) return "";
  const clone = editorEl.cloneNode(true);

  clone.querySelectorAll("span[data-field]").forEach((span) => {
    const input = document.createElement("input");
    input.type = "text";
    input.name = span.getAttribute("data-field");
    input.value = span.textContent;
    input.style.cssText =
      "border:none;border-bottom:1px dotted #000;min-width:80px;" +
      "font-family:inherit;font-size:inherit;outline:none;background:transparent;" +
      "display:inline-block;vertical-align:baseline;";
    span.parentNode.replaceChild(input, span);
  });

  clone.querySelectorAll("div[data-field]").forEach((div) => {
    const ta = document.createElement("textarea");
    ta.name = div.getAttribute("data-field");
    ta.rows = 1;
    ta.textContent = div.textContent;
    ta.style.cssText =
      "border:none;border-bottom:1px dotted #000;min-width:200px;width:100%;" +
      "font-family:inherit;font-size:inherit;outline:none;background:transparent;" +
      "display:block;resize:none;overflow:hidden;padding:0;margin:0;" +
      "line-height:inherit;box-sizing:border-box;";
    div.parentNode.replaceChild(ta, div);
  });

  return clone.innerHTML;
}

// ── Toolbar ──
function SimpleToolbar() {
  const exec = (cmd, val) => document.execCommand(cmd, false, val || null);

  const FONT_FAMILIES = [
    "Times New Roman","Arial","Calibri","Georgia","Verdana","Tahoma","Courier New",
  ];
  const COLORS = [
    "#000000","#374151","#ef4444","#f97316","#eab308","#22c55e",
    "#3b82f6","#8b5cf6","#ec4899","#dc2626","#16a34a","#1d4ed8","#ffffff",
  ];

  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #e5e7eb",
      padding: "6px 12px",
      flexShrink: 0,         // KHÔNG co lại
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:2, alignItems:"center", marginBottom:4 }}>
        <TBtn title="Hoàn tác" onClick={() => exec("undo")}>↩</TBtn>
        <TBtn title="Làm lại" onClick={() => exec("redo")}>↪</TBtn>
        <Sep />
        <select title="Font chữ" defaultValue="Times New Roman"
          onChange={(e) => exec("fontName", e.target.value)} style={selSt}>
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select title="Cỡ chữ" defaultValue="3"
          onChange={(e) => exec("fontSize", e.target.value)}
          style={{ ...selSt, width:68 }}>
          <option value="1">8pt</option>
          <option value="2">10pt</option>
          <option value="3">12pt</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>
        <Sep />
        <TBtn title="Đậm (Ctrl+B)" onClick={() => exec("bold")}><strong>B</strong></TBtn>
        <TBtn title="Nghiêng (Ctrl+I)" onClick={() => exec("italic")}><em>I</em></TBtn>
        <TBtn title="Gạch chân (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></TBtn>
        <TBtn title="Gạch ngang" onClick={() => exec("strikeThrough")}><s>S</s></TBtn>
        <Sep />
        <TBtn title="Căn trái" onClick={() => exec("justifyLeft")}>≡</TBtn>
        <TBtn title="Căn giữa" onClick={() => exec("justifyCenter")}>⊟</TBtn>
        <TBtn title="Căn phải" onClick={() => exec("justifyRight")}>
          <span style={{ transform:"scaleX(-1)", display:"inline-block" }}>≡</span>
        </TBtn>
        <TBtn title="Căn đều" onClick={() => exec("justifyFull")}>☰</TBtn>
        <Sep />
        <TBtn title="Danh sách" onClick={() => exec("insertUnorderedList")}>• ≡</TBtn>
        <TBtn title="Danh sách số" onClick={() => exec("insertOrderedList")}>1≡</TBtn>
        <Sep />
        <TBtn title="Tăng thụt lề" onClick={() => exec("indent")}>→|</TBtn>
        <TBtn title="Giảm thụt lề" onClick={() => exec("outdent")}>|←</TBtn>
        <Sep />
        <TBtn title="Xóa định dạng" onClick={() => exec("removeFormat")}>🧹</TBtn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:2, alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#6b7280", marginRight:4 }}>Màu chữ:</span>
        {COLORS.map(c => (
          <button key={c} type="button" title={c}
            onClick={() => exec("foreColor", c)}
            style={{ width:18, height:18, borderRadius:3, border:"1px solid #e5e7eb", background:c, cursor:"pointer" }} />
        ))}
        <Sep />
        <span style={{ fontSize:12, color:"#6b7280", marginRight:4 }}>Tô màu:</span>
        {["#fef08a","#bbf7d0","#bfdbfe","#fecaca","#f5d0fe"].map(c => (
          <button key={c} type="button" title={c}
            onClick={() => exec("hiliteColor", c)}
            style={{ width:22, height:22, borderRadius:4, border:"1px solid #e5e7eb", background:c, cursor:"pointer" }} />
        ))}
      </div>
    </div>
  );
}

function TBtn({ onClick, title, children }) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:30, height:28, padding:"0 4px", border:"none",
        borderRadius:4, cursor:"pointer", background:"transparent",
        color:"#374151", fontSize:13,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >{children}</button>
  );
}

const Sep = () => (
  <span style={{ width:1, height:22, background:"#d1d5db", margin:"0 3px", display:"inline-block" }} />
);

const selSt = {
  height:28, padding:"0 4px", borderRadius:4,
  border:"1px solid #d1d5db", fontSize:12,
  background:"#fff", cursor:"pointer", width:140, color:"#374151",
};

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function FormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedFormId, setUploadedFormId] = useState(null);
  const [uploadedHtml, setUploadedHtml] = useState("");
  const [uploadedTitle, setUploadedTitle] = useState("");

  const editorRef = useRef(null);

  useEffect(() => {
    api.get("/forms/categories/list").then((r) => setCategories(r.data || []));
  }, []);

  const loadForm = useCallback((node) => {
    if (!node || !id) return;
    editorRef.current = node;
    api.get(`/forms/${id}`).then((r) => {
      node.innerHTML = convertToEditable(r.data.template_html || "");
      setTitle(r.data.title || "");
      setDescription(r.data.description || "");
      setCategoryId(r.data.category_id || "");
    });
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tiêu đề!"); return; }
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const inner = convertBackToForm(editorRef.current);
      const fullHtml = `<div class="word-document" style="font-family:'Times New Roman',Times,serif;font-size:14pt;line-height:2;color:#000;width:100%;box-sizing:border-box;background:#fff;">${inner}</div>`;
      await api.put(`/forms/${id}`, {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId || null,
        template_html: fullHtml,
        created_by: user?.user_id || 1,
        fields: [],
      });
      alert("Lưu thành công!");
      navigate("/admin");
    } catch {
      alert("Lỗi khi lưu biểu mẫu.");
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceFile = async (newFormId) => {
    setUploadLoading(true);
    try {
      const res = await api.get(`/forms/${newFormId}`);
      if (editorRef.current) {
        editorRef.current.innerHTML = convertToEditable(res.data.template_html || "");
      }
      await api.delete(`/forms/${newFormId}`);
      alert("Đã tải nội dung mới vào editor!");
    } catch {
      alert("Lỗi khi tải nội dung mới.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUploadSuccess = async (formId) => {
    setUploadLoading(true);
    try {
      const res = await api.get(`/forms/${formId}`);
      setUploadedFormId(formId);
      setUploadedHtml(res.data.template_html || "");
      setUploadedTitle(res.data.title || "");
    } catch {
      alert("Không thể tải xem trước.");
      navigate("/admin");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleConfirmUpload = () => navigate("/admin");
  const handleCancelUpload = async () => {
    if (!window.confirm("Hủy và xóa biểu mẫu này?")) return;
    try { await api.delete(`/forms/${uploadedFormId}`); } catch {}
    setUploadedFormId(null);
    setUploadedHtml("");
  };

  if (uploadLoading) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>⏳</div>
          <p style={{ color:"#43bfc9", fontWeight:700, fontSize:18 }}>Đang xử lý...</p>
        </div>
      </div>
    );
  }

  if (!id && uploadedFormId) {
    return (
      <div style={{ fontFamily:"Segoe UI", background:"#f0f4f8", minHeight:"100vh" }}>
        <div style={TS.previewBar}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#12323a" }}>
              👁️ Xem trước: <span style={{ color:"#43bfc9" }}>{uploadedTitle}</span>
            </div>
            <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>Kiểm tra trước khi lưu.</div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleCancelUpload} style={TS.btnDanger}>🗑️ Hủy & Xóa</button>
            <button onClick={handleConfirmUpload} style={TS.btnPrimary}>✅ Xác nhận lưu</button>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"center", padding:"28px 24px 60px" }}>
          <div className="word-document" style={TS.previewDoc}
            dangerouslySetInnerHTML={{ __html: uploadedHtml }} />
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div style={{ padding:"28px", fontFamily:"Segoe UI", background:"#f8fafb", minHeight:"100vh" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:26, fontWeight:800, color:"#12323a" }}>➕ Tạo biểu mẫu mới</h2>
            <p style={{ margin:"6px 0 0", fontSize:14, color:"#6b7280" }}>Tải lên file Word hoặc PDF.</p>
          </div>
          <button onClick={() => setIsPDFModalOpen(true)} style={TS.btnUpload}>📁 Tải file từ máy tính</button>
        </div>
        <hr style={{ border:"none", borderTop:"1px solid #e5e7eb", margin:"20px 0 24px" }} />
        <div style={{ display:"flex", gap:14, alignItems:"flex-start", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"16px 20px", fontSize:14, color:"#1e40af", lineHeight:1.7 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>💡</span>
          <div>
            <strong>Hướng dẫn:</strong> Nhấn <strong>"Tải file từ máy tính"</strong> để upload <strong>Word (.docx, .doc)</strong> hoặc <strong>PDF</strong>.
          </div>
        </div>
        <PDFUploadModal isOpen={isPDFModalOpen} onClose={() => setIsPDFModalOpen(false)} onSuccess={handleUploadSuccess} />
      </div>
    );
  }

  // ════ EDIT MODE ════
  // Layout: toàn trang = 100vh, không scroll ở body
  // Chỉ vùng editor (cột phải bên dưới toolbar) mới scroll
  return (
    <div style={{
      fontFamily:"Segoe UI",
      background:"#f0f2f5",
      height:"100vh",           // Chiếm toàn màn hình
      display:"flex",
      flexDirection:"column",
      overflow:"hidden",        // Không để body scroll
    }}>

      {/* ── Top bar (cố định trên cùng) ── */}
      <div style={TS.topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => navigate("/admin")} style={TS.btnBack}>← Quay lại</button>
          <div style={{ fontWeight:700, fontSize:15, color:"#16323a" }}>✏️ Chỉnh sửa biểu mẫu</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={() => setIsPDFModalOpen(true)} style={TS.btnUpload}>
            🔄 Thay nội dung bằng file mới
          </button>
          <button onClick={handleSave} disabled={saving} style={TS.btnPrimary}>
            {saving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
          </button>
        </div>
      </div>

      {/* ── Body (flex row, fill phần còn lại) ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Cột trái: Meta — scroll riêng nếu nội dung dài */}
        <div style={TS.metaSidebar}>
          <div style={TS.metaCard}>
            <div style={TS.metaTitle}>📋 Thông tin</div>
            <label style={TS.lbl}>Tiêu đề <span style={{ color:"#ef4444" }}>*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              style={TS.inp} placeholder="Tiêu đề biểu mẫu..." />
            <label style={TS.lbl}>Mô tả</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              style={TS.inp} placeholder="Mô tả ngắn (không bắt buộc)" />
            <label style={TS.lbl}>Danh mục</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={TS.inp}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={TS.hintCard}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:13 }}>💡 Hướng dẫn</div>
            <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:"#92400e", lineHeight:1.8 }}>
              <li>Bấm vào văn bản để chỉnh sửa trực tiếp</li>
              <li>Các ô gạch dưới vẫn điền được sau khi lưu</li>
              <li>Dùng toolbar để định dạng văn bản</li>
              <li>Ctrl+B: Đậm | Ctrl+I: Nghiêng | Ctrl+Z: Undo</li>
            </ul>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ ...TS.btnPrimary, width:"100%", padding:12, marginTop:12 }}>
            {saving ? "⏳ Đang lưu..." : "💾 Lưu tất cả thay đổi"}
          </button>
        </div>

        {/* Cột phải: Toolbar cố định + Editor scroll */}
        <div style={{
          flex:1,
          display:"flex",
          flexDirection:"column",
          overflow:"hidden",   // Quan trọng: không scroll ở đây
          minWidth:0,
        }}>

          {/* Toolbar — KHÔNG scroll, luôn nhìn thấy */}
          <SimpleToolbar />

          {/* Editor — CHỈ phần này scroll */}
          <div style={{
            flex:1,
            overflowY:"auto",   // Chỉ đây scroll
            background:"#e8eaed",
            padding:"32px 0 60px",
          }}>
            <style>{`
              .editor-page table { width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:4px; }
              .editor-page td, .editor-page th { padding:2px 4px; vertical-align:top; word-wrap:break-word; }
              .editor-page table:not(.two-col-row) td,
              .editor-page table:not(.two-col-row) th { border:1px solid #ccc; }
              .editor-page table.two-col-row { border:none !important; margin:2px 0 !important; }
              .editor-page table.two-col-row td,
              .editor-page table.two-col-row th { border:none !important; padding:1px 0 !important; vertical-align:top; background:transparent !important; }
              .editor-page table.two-col-row td.col-left { width:45%; text-align:left; }
              .editor-page table.two-col-row td.col-right { width:55%; text-align:center; }
              .editor-page table.signature-row td.col-right { text-align:center; vertical-align:top; }
              .editor-page p { margin:4px 0; line-height:2; }
              .editor-page h1,.editor-page h2,.editor-page h3 { text-align:center; margin:10px 0; font-weight:bold; }
              .editor-page .doc-center { text-align:center !important; }
              .editor-page span[data-field] {
                border-bottom:1px solid #333 !important;
                display:inline-block; min-width:80px; cursor:text; outline:none;
              }
              .editor-page span[data-field]:focus,
              .editor-page span[data-field]:hover { background:#fffde7 !important; }
              .editor-page div[data-field] {
                border-bottom:1px solid #333 !important;
                display:block; min-width:200px; min-height:1.5em;
                width:100%; cursor:text; outline:none;
              }
              .editor-page div[data-field]:focus,
              .editor-page div[data-field]:hover { background:#fffde7 !important; }
            `}</style>

            {/* Trang giấy A4 — rộng hơn, căn giữa */}
            <div style={{ display:"flex", justifyContent:"center", padding:"0 16px" }}>
              <div
                ref={loadForm}
                className="editor-page"
                contentEditable={true}
                suppressContentEditableWarning={true}
                style={{
                  width:"240mm",          // Rộng hơn A4 chuẩn để dễ nhìn
                  minHeight:"297mm",
                  padding:"20mm 28mm",
                  background:"#fff",
                  boxShadow:"0 4px 32px rgba(0,0,0,0.15)",
                  boxSizing:"border-box",
                  fontFamily:"'Times New Roman', Times, serif",
                  fontSize:"14pt",
                  lineHeight:2,
                  color:"#000",
                  outline:"none",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <PDFUploadModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        onSuccess={id ? handleReplaceFile : handleUploadSuccess}
      />
    </div>
  );
}

/* ─── Styles ─── */
const TS = {
  topBar: {
    height:56, background:"#fff",
    borderBottom:"1px solid #e5e7eb",
    display:"flex", justifyContent:"space-between",
    alignItems:"center", padding:"0 20px",
    gap:12, flexWrap:"wrap",
    boxShadow:"0 1px 6px rgba(0,0,0,0.06)",
    flexShrink:0,   // Không co lại
    zIndex:200,
  },
  metaSidebar: {
    width:240,
    flexShrink:0,
    background:"#f8fafb",
    borderRight:"1px solid #e5e7eb",
    padding:"16px 14px",
    overflowY:"auto",   // Sidebar tự scroll nếu cần
  },
  metaCard: {
    background:"#fff", border:"1px solid #e5e7eb",
    borderRadius:12, padding:14, marginBottom:12,
  },
  metaTitle: { fontWeight:700, fontSize:13, color:"#374151", marginBottom:12 },
  hintCard: {
    background:"#fffbeb", border:"1px solid #fde68a",
    borderRadius:10, padding:"12px 14px", color:"#92400e",
  },
  lbl: {
    display:"block", fontSize:12, fontWeight:600,
    color:"#374151", marginBottom:4, marginTop:10,
  },
  inp: {
    width:"100%", padding:"8px 10px", borderRadius:7,
    border:"1px solid #d1d5db", fontSize:13, outline:"none",
    boxSizing:"border-box", background:"#fff",
  },
  previewBar: {
    display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", flexWrap:"wrap",
    gap:16, padding:"16px 24px", background:"#fff",
    borderBottom:"1px solid #d1fae5",
    boxShadow:"0 2px 8px rgba(67,191,201,0.08)",
    position:"sticky", top:0, zIndex:100,
  },
  previewDoc: {
    width:"210mm", minHeight:"297mm",
    padding:"20mm 25mm", background:"#fff",
    boxShadow:"0 4px 24px rgba(0,0,0,0.1)",
    fontFamily:"'Times New Roman', serif",
    fontSize:"14pt", lineHeight:2,
    boxSizing:"border-box", borderRadius:4,
  },
  btnBack: {
    padding:"8px 14px", background:"#eceff1",
    color:"#546e7a", border:"none", borderRadius:8,
    cursor:"pointer", fontWeight:600, fontSize:13,
  },
  btnPrimary: {
    padding:"9px 18px",
    background:"linear-gradient(135deg,#43bfc9,#2196f3)",
    color:"#fff", border:"none", borderRadius:9,
    cursor:"pointer", fontWeight:700, fontSize:14,
    boxShadow:"0 4px 14px rgba(67,191,201,0.3)",
  },
  btnUpload: {
    padding:"9px 16px",
    background:"linear-gradient(135deg,#f97316,#ef4444)",
    color:"#fff", border:"none", borderRadius:9,
    cursor:"pointer", fontWeight:700, fontSize:13,
    boxShadow:"0 4px 14px rgba(239,68,68,0.25)",
  },
  btnDanger: {
    padding:"9px 16px", background:"#fee2e2",
    color:"#ef4444", border:"1px solid #fca5a5",
    borderRadius:9, cursor:"pointer", fontWeight:700, fontSize:13,
  },
};