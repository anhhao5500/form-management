import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import html2pdf from "html2pdf.js";

// ── Validate số cho input ngày/tháng/năm ──
function applyDateValidation(container) {
  container.querySelectorAll("input[data-date-field='1']").forEach((input) => {
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[0-9]*");
    input.addEventListener("keypress", (e) => {
      if (
        !/[0-9]/.test(e.key) &&
        !["Backspace","Delete","Tab","Enter","ArrowLeft","ArrowRight"].includes(e.key)
      ) e.preventDefault();
    });
    input.addEventListener("input", (e) => {
      const cleaned = e.target.value.replace(/[^0-9]/g, "");
      if (e.target.value !== cleaned) e.target.value = cleaned;
    });
  });
}

// ── Tự viết hoa chữ đầu câu ──
function applyAutoCaps(container) {
  container.querySelectorAll("input[type='text'], textarea").forEach((el) => {
    if (el.dataset.dateField) return;
    el.addEventListener("input", (e) => {
      const val = e.target.value;
      const pos = e.target.selectionStart;
      if (val.length === 1) {
        const upper = val.charAt(0).toUpperCase();
        if (upper !== val.charAt(0)) {
          e.target.value = upper;
          e.target.setSelectionRange(1, 1);
        }
        return;
      }
      const newVal = val.replace(
        /([.!?]\s+)([a-záàảãạăắặẳẵằâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])/gi,
        (match, punct, char) => punct + char.toUpperCase()
      );
      if (newVal !== val) {
        e.target.value = newVal;
        e.target.setSelectionRange(pos, pos);
      }
    });
  });
}

// ── Auto resize textarea ──
function applyAutoResize(container) {
  container.querySelectorAll("textarea").forEach((ta) => {
    const resize = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
    resize();
    ta.addEventListener("input", resize);
  });
}

// ── CSS dùng chung cho print và PDF export ──
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 15mm 20mm 15mm 25mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #form-print-area, #form-print-area * { visibility: visible !important; }
  #form-print-area {
    position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
    width: 100% !important; padding: 0 !important; margin: 0 !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
    background: #fff !important; overflow: visible !important;
    font-family: 'Times New Roman', Times, serif !important;
    font-size: 11pt !important; line-height: 1.5 !important; color: #000 !important;
  }
  #form-print-area .word-document {
    font-size: 11pt !important; line-height: 1.5 !important;
    padding: 0 !important; margin: 0 !important; width: 100% !important;
  }
  #form-print-area p { margin: 2px 0 !important; line-height: 1.5 !important; font-size: 11pt !important; }
  #form-print-area h1, #form-print-area h2, #form-print-area h3 {
    font-size: 11pt !important; line-height: 1.5 !important; margin: 4px 0 !important; text-align: center !important;
  }
  #form-print-area .doc-center,
  #form-print-area p > strong:only-child,
  #form-print-area p > b:only-child { text-align: center !important; display: block !important; font-size: 11pt !important; }

  /* ── 2 cột văn bản hành chính ── */
  #form-print-area table { width: 100% !important; border-collapse: collapse !important; font-size: 11pt !important; }
  #form-print-area table.two-col-row {
    width: 100% !important; border-collapse: collapse !important;
    table-layout: fixed !important; margin: 0 !important; border: none !important;
  }
  #form-print-area table.two-col-row td {
    border: none !important; padding: 1px 0 !important;
    vertical-align: top !important; word-wrap: break-word !important;
    white-space: normal !important; width: 50% !important; font-size: 11pt !important;
  }
  #form-print-area table.two-col-row td.col-left  { text-align: left !important; }
  #form-print-area table.two-col-row td.col-right { text-align: center !important; }

  #form-print-area td, #form-print-area th {
    font-size: 11pt !important; line-height: 1.5 !important;
    padding: 2px 4px !important; vertical-align: top !important;
    word-wrap: break-word !important; white-space: normal !important;
  }
  #form-print-area input[type="text"], #form-print-area textarea {
    font-family: 'Times New Roman', Times, serif !important;
    font-size: 11pt !important; line-height: 1.5 !important;
    border: none !important; border-bottom: 1px dotted #000 !important;
    background: transparent !important; padding: 0 !important; margin: 0 !important;
    resize: none !important; overflow: visible !important; height: auto !important;
  }
  #form-print-area b, #form-print-area strong { font-weight: bold !important; }
  #form-print-area i, #form-print-area em { font-style: italic !important; }
  #form-print-area .page-break { display: none !important; }
  .no-print { display: none !important; }
`;

// ── CSS cho PDF export (inline vào wrapper) ──
const PDF_INNER_CSS = `
  .word-document { font-size: 11pt !important; line-height: 1.5 !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
  p { margin: 2px 0 !important; line-height: 1.5 !important; font-size: 11pt !important; }
  h1, h2, h3 { font-size: 11pt !important; text-align: center !important; margin: 4px 0 !important; }
  .doc-center, p > strong:only-child, p > b:only-child { text-align: center !important; display: block !important; }

  table { width: 100% !important; border-collapse: collapse !important; font-size: 11pt !important; }
  table.two-col-row {
    width: 100% !important; border-collapse: collapse !important;
    table-layout: fixed !important; margin: 0 !important; border: none !important;
  }
  table.two-col-row td {
    border: none !important; padding: 1px 0 !important;
    vertical-align: top !important; word-wrap: break-word !important;
    white-space: normal !important; width: 50% !important; font-size: 11pt !important;
    line-height: 1.5 !important;
  }
  table.two-col-row td.col-left  { text-align: left !important; }
  table.two-col-row td.col-right { text-align: center !important; }

  td, th { word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 2px 4px !important; vertical-align: top !important; white-space: normal !important; font-size: 11pt !important; }
  b, strong { font-weight: bold !important; }
  i, em { font-style: italic !important; }
  .page-break { display: none !important; }
`;

export default function FormDetail() {
  const { id } = useParams();
  const cleanFormId = useMemo(() => id?.replace(":", ""), [id]);

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submissionId, setSubmissionId] = useState(null);
  const [showAutofill, setShowAutofill] = useState(false);
  const [autofillDone, setAutofillDone] = useState(false);

  const valuesRef = useRef({});
  const htmlContainerRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // ── Load form ──
  useEffect(() => {
    if (!cleanFormId) return;
    api.get(`/forms/${cleanFormId}`)
      .then((res) => {
        setForm(res.data);
        const init = {};
        (res.data.fields || []).forEach((f) => { init[f.field_name] = ""; });
        valuesRef.current = init;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cleanFormId]);

  // ── Render HTML + behaviors ──
  useEffect(() => {
    if (!form?.template_html || form?.template_pdf) return;
    if (!htmlContainerRef.current) return;

    htmlContainerRef.current.innerHTML = form.template_html;

    // Fix placeholder (n) cho form cũ
    htmlContainerRef.current
      .querySelectorAll('input[placeholder^="("]')
      .forEach((el) => el.removeAttribute("placeholder"));

    // Inject print styles
    let printStyle = document.getElementById("print-style-inject");
    if (!printStyle) {
      printStyle = document.createElement("style");
      printStyle.id = "print-style-inject";
      document.head.appendChild(printStyle);
    }
    printStyle.textContent = `@media print { ${PRINT_CSS} }`;

    applyAutoResize(htmlContainerRef.current);
    applyDateValidation(htmlContainerRef.current);
    applyAutoCaps(htmlContainerRef.current);

    if (!user) {
      htmlContainerRef.current.querySelectorAll("input, textarea").forEach((el) => {
        el.disabled = true;
        el.style.backgroundColor = "#f5f5f5";
        el.style.cursor = "not-allowed";
      });
    }

    const handleInput = (e) => {
      const target = e.target;
      if ((target.tagName === "INPUT" || target.tagName === "TEXTAREA") && target.name)
        valuesRef.current[target.name] = target.value;
    };
    htmlContainerRef.current.addEventListener("input", handleInput);

    if (user && !autofillDone && (user.full_name || user.phone || user.address || user.dob))
      setShowAutofill(true);

    return () => {
      if (htmlContainerRef.current)
        htmlContainerRef.current.removeEventListener("input", handleInput);
      const ps = document.getElementById("print-style-inject");
      if (ps) ps.remove();
    };
  }, [form]);

  // ── Autofill ──
  const handleAutofill = () => {
    if (!htmlContainerRef.current || !user) return;
    const autofillMap = {
      ho_ten: user.full_name, full_name: user.full_name,
      hoten: user.full_name, nguoi_ky: user.full_name, ten: user.full_name,
      sdt: user.phone, phone: user.phone,
      so_dien_thoai: user.phone, dien_thoai: user.phone,
      dia_chi: user.address, address: user.address, diachi: user.address,
      ngay_sinh: user.dob ? user.dob.split("T")[0] : "",
      dob: user.dob ? user.dob.split("T")[0] : "",
      sinh_ngay: user.dob ? user.dob.split("T")[0] : "",
    };
    htmlContainerRef.current.querySelectorAll("input[name], textarea[name]").forEach((el) => {
      const name = el.getAttribute("name")?.toLowerCase();
      if (name && autofillMap[name]) {
        el.value = autofillMap[name];
        valuesRef.current[el.getAttribute("name")] = autofillMap[name];
        if (el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
      }
    });
    setShowAutofill(false);
    setAutofillDone(true);
  };

  // ── Tạo wrapper PDF/Print dùng chung ──
  const buildPrintWrapper = () => {
    const element = htmlContainerRef.current;
    if (!element) return null;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      width: 210mm; min-height: 297mm;
      padding: 15mm 20mm 15mm 25mm;
      box-sizing: border-box; background: #fff;
      font-family: 'Times New Roman', serif;
      font-size: 11pt; line-height: 1.5; color: #000;
    `;

    // CSS inline giữ layout 2 cột
    const styleEl = document.createElement("style");
    styleEl.textContent = PDF_INNER_CSS;
    wrapper.appendChild(styleEl);

    // Clone nội dung
    const clone = element.cloneNode(true);

    // Thay input/textarea → span chứa giá trị
    const originalInputs = element.querySelectorAll("input, textarea");
    const clonedInputs   = clone.querySelectorAll("input, textarea");
    originalInputs.forEach((original, index) => {
      const clonedEl = clonedInputs[index];
      if (!clonedEl) return;
      const val = original.value || "";
      const span = document.createElement("span");
      span.innerText = val;
      span.style.cssText = `
        display: inline;
        border-bottom: 1px dotted #000;
        min-width: 40px;
        font-family: 'Times New Roman', serif;
        font-size: 11pt; line-height: 1.5;
        word-break: break-word;
      `;
      clonedEl.parentNode?.replaceChild(span, clonedEl);
    });

    // Reset style clone
    clone.removeAttribute("style");
    clone.style.cssText = `
      width: 100%; font-size: 11pt; line-height: 1.5;
      font-family: 'Times New Roman', serif; color: #000;
    `;
    wrapper.appendChild(clone);
    return wrapper;
  };

  // ── In ──
  const handlePrint = () => {
    const container = htmlContainerRef.current;
    if (!container) return window.print();

    // Thay input → span trước khi in
    const inputs = container.querySelectorAll("input, textarea");
    const backups = [];
    inputs.forEach((el) => {
      const val = el.value || "";
      const span = document.createElement("span");
      span.setAttribute("data-print-placeholder", "true");
      span.innerText = val;
      span.style.cssText = `
        display: inline; border-bottom: 1px dotted #000;
        min-width: 40px; font-family: inherit; font-size: inherit;
        line-height: inherit; word-break: break-word;
      `;
      backups.push({ el, parent: el.parentNode, val });
      el.parentNode.replaceChild(span, el);
    });

    window.print();

    // Khôi phục sau khi print
    backups.forEach(({ el, parent, val }) => {
      const span = parent.querySelector('[data-print-placeholder="true"]');
      if (span) parent.replaceChild(el, span);
      el.value = val;
      if (el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
    });
  };

  // ── Export PDF ──
  const handleExportPDFLocal = () => {
    if (!htmlContainerRef.current) return alert("Không tìm thấy nội dung!");
    const wrapper = buildPrintWrapper();
    if (!wrapper) return;

    html2pdf()
      .set({
        margin: 0,
        filename: `bieu-mau-${cleanFormId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2, useCORS: true, letterRendering: true,
          scrollY: 0, windowWidth: 1123, windowHeight: 1587,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(wrapper)
      .save();
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!user) return alert("Vui lòng đăng nhập");
    try {
      const allValues = { ...valuesRef.current };
      if (htmlContainerRef.current) {
        htmlContainerRef.current.querySelectorAll("input[name], textarea[name]").forEach((el) => {
          if (el.name) allValues[el.name] = el.value;
        });
      }
      const submissionData = (form.fields || []).map((f) => ({
        field_id: f.field_id,
        value: allValues[f.field_name] || "",
      }));
      const res = await api.post("/submissions", {
        form_id: Number(cleanFormId),
        user_id: user.user_id,
        data: submissionData,
        values: allValues,
      });
      setSubmissionId(res.data.submission_id);
      alert("Lưu dữ liệu thành công!");
    } catch (err) {
      console.error("Lỗi:", err);
      alert("Lỗi khi lưu dữ liệu.");
    }
  };

  const hasHtmlTemplate = !!(form?.template_html && !form?.template_pdf);

  if (loading) return <p style={{ textAlign: "center", marginTop: "50px" }}>Đang tải biểu mẫu...</p>;

  return (
    <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", padding: "20px 0" }}>

      {/* ===== AUTOFILL FRAME ===== */}
      {showAutofill && user && (
        <div style={AS.overlay}>
          <div style={AS.frame}>
            <div style={AS.header}>
              <span style={AS.headerIcon}>⚡</span>
              <span style={AS.headerTitle}>Tự động điền thông tin</span>
              <button style={AS.closeBtn} onClick={() => setShowAutofill(false)}>✕</button>
            </div>
            <p style={AS.desc}>Hệ thống phát hiện bạn có thông tin cá nhân. Bạn có muốn tự động điền vào biểu mẫu không?</p>
            <div style={AS.infoList}>
              {user.full_name && <div style={AS.infoRow}><span style={AS.infoIcon}>👤</span><span style={AS.infoLabel}>Họ và tên:</span><span style={AS.infoValue}>{user.full_name}</span></div>}
              {user.phone    && <div style={AS.infoRow}><span style={AS.infoIcon}>📞</span><span style={AS.infoLabel}>SĐT:</span><span style={AS.infoValue}>{user.phone}</span></div>}
              {user.dob      && <div style={AS.infoRow}><span style={AS.infoIcon}>🎂</span><span style={AS.infoLabel}>Ngày sinh:</span><span style={AS.infoValue}>{new Date(user.dob).toLocaleDateString("vi-VN")}</span></div>}
              {user.address  && <div style={AS.infoRow}><span style={AS.infoIcon}>📍</span><span style={AS.infoLabel}>Địa chỉ:</span><span style={AS.infoValue}>{user.address}</span></div>}
            </div>
            <div style={AS.actions}>
              <button style={AS.btnSkip} onClick={() => { setShowAutofill(false); setAutofillDone(true); }}>Bỏ qua</button>
              <button style={AS.btnFill} onClick={handleAutofill}>⚡ Tự động điền</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="no-print" style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#333", margin: 0 }}>{form?.title}</h2>
        {!user && <p style={{ color: "#d32f2f", fontWeight: "bold", marginTop: 8 }}>Chế độ xem trước — Đăng nhập để điền và lưu biểu mẫu.</p>}
      </div>

      {/* ===== HTML/DOCX FORM ===== */}
      {hasHtmlTemplate && (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
          <div
            ref={htmlContainerRef}
            id="form-print-area"
            className="word-document"
            style={{
              width: "100%", minHeight: "297mm",
              padding: "20mm 60mm 20mm 60mm",
              border: "1px solid #ddd", backgroundColor: "#fff",
              borderRadius: "6px", boxSizing: "border-box",
              boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
              fontFamily: "'Times New Roman', serif",
              fontSize: "14pt", lineHeight: "2",
            }}
          />

          {user && (
            <div
              className="no-print"
              style={{ textAlign: "center", marginTop: "24px", display: "flex", justifyContent: "center", gap: "15px", flexWrap: "wrap", paddingBottom: "40px" }}
            >
              <button onClick={handleSubmit} style={BS.save}>💾 Lưu dữ liệu và Hoàn tất</button>
              <button onClick={handlePrint} style={BS.print}>🖨️ In biểu mẫu</button>
              {submissionId && <button onClick={handleExportPDFLocal} style={BS.export}>📄 Tải tệp PDF</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const AS = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 },
  frame: { background: "#fff", borderRadius: "16px", padding: "24px", width: "400px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #eef6f8" },
  headerIcon: { fontSize: 22 },
  headerTitle: { flex: 1, fontWeight: "700", fontSize: 16, color: "#16323a" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", lineHeight: 1 },
  desc: { fontSize: 14, color: "#555", marginBottom: 16, lineHeight: 1.6 },
  infoList: { background: "#f6fcfd", borderRadius: 10, padding: "12px 14px", marginBottom: 18, border: "1px solid #d7ecef" },
  infoRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 14 },
  infoIcon: { fontSize: 16, width: 22, textAlign: "center" },
  infoLabel: { fontWeight: "600", color: "#16323a", minWidth: 80 },
  infoValue: { color: "#444", flex: 1 },
  actions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  btnSkip: { padding: "9px 18px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontWeight: "600", color: "#666" },
  btnFill: { padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #43bfc9, #7fd7df)", color: "#fff", cursor: "pointer", fontWeight: "700", boxShadow: "0 4px 12px rgba(67,191,201,0.3)" },
};

const BS = {
  save:   { padding: "12px 35px", fontSize: "15px", fontWeight: "600", cursor: "pointer", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "8px" },
  export: { padding: "12px 35px", fontSize: "15px", fontWeight: "600", cursor: "pointer", backgroundColor: "#28a745", color: "#fff", border: "none", borderRadius: "8px" },
  print:  { padding: "12px 35px", fontSize: "15px", fontWeight: "600", cursor: "pointer", backgroundColor: "#6c757d", color: "#fff", border: "none", borderRadius: "8px" },
};