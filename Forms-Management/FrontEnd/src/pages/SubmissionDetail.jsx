import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import html2pdf from "html2pdf.js";

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cleanId = useMemo(() => id?.replace(":", ""), [id]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const valuesRef = useRef({});
  const htmlContainerRef = useRef(null);

  useEffect(() => {
    if (!cleanId) return;
    api.get(`/submissions/${cleanId}`).then((res) => {
      setData(res.data);
      valuesRef.current = res.data.rawData || {};
      setLoading(false);
    });
  }, [cleanId]);

  // ── Render HTML template + điền dữ liệu đã lưu ──
  useEffect(() => {
    if (loading || !data?.info?.template_html) return;
    if (!htmlContainerRef.current) return;

    htmlContainerRef.current.innerHTML = data.info.template_html;

    const saved = data.rawData || {};

    // Điền giá trị đã lưu vào các input/textarea
    htmlContainerRef.current.querySelectorAll("input[name], textarea[name]").forEach((el) => {
      const name = el.getAttribute("name");
      if (name && saved[name] !== undefined) {
        el.value = saved[name];
      }
      // Auto resize textarea
      if (el.tagName === "TEXTAREA") {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
      el.addEventListener("input", (e) => {
        valuesRef.current[name] = e.target.value;
        if (el.tagName === "TEXTAREA") {
          el.style.height = "auto";
          el.style.height = el.scrollHeight + "px";
        }
      });
    });

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
    printStyle.textContent = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 15mm 20mm 15mm 25mm;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body * { visibility: hidden !important; }
        #submission-print-area,
        #submission-print-area * { visibility: visible !important; }
        #submission-print-area {
          position: fixed !important;
          top: 0 !important; left: 0 !important; right: 0 !important;
          width: 100% !important;
          padding: 0 !important; margin: 0 !important;
          box-shadow: none !important; border: none !important;
          border-radius: 0 !important; background: #fff !important;
          overflow: visible !important;
        }
        #submission-print-area,
        #submission-print-area .word-document {
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 11pt !important;
          line-height: 1.5 !important;
          color: #000 !important;
          width: 100% !important;
          padding: 0 !important; margin: 0 !important;
        }
        #submission-print-area p {
          margin: 2px 0 !important;
          line-height: 1.5 !important;
          font-size: 11pt !important;
        }
        #submission-print-area h1,
        #submission-print-area h2,
        #submission-print-area h3 {
          font-size: 11pt !important;
          line-height: 1.5 !important;
          margin: 4px 0 !important;
          text-align: center !important;
        }
        #submission-print-area .doc-center,
        #submission-print-area p > strong:only-child,
        #submission-print-area p > b:only-child {
          text-align: center !important;
          display: block !important;
          font-size: 11pt !important;
        }
        #submission-print-area input[type="text"],
        #submission-print-area textarea {
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 11pt !important;
          line-height: 1.5 !important;
          border: none !important;
          border-bottom: 1px dotted #000 !important;
          background: transparent !important;
          padding: 0 !important; margin: 0 !important;
          resize: none !important;
          overflow: visible !important;
          height: auto !important;
        }
        #submission-print-area table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-size: 11pt !important;
        }
        #submission-print-area td,
        #submission-print-area th {
          font-size: 11pt !important;
          line-height: 1.5 !important;
          padding: 2px 4px !important;
          vertical-align: top !important;
          word-wrap: break-word !important;
          white-space: normal !important;
        }
        #submission-print-area b,
        #submission-print-area strong { font-weight: bold !important; }
        #submission-print-area i,
        #submission-print-area em { font-style: italic !important; }
        .no-print { display: none !important; }
      }
    `;

    return () => {
      const ps = document.getElementById("print-style-inject");
      if (ps) ps.remove();
    };
  }, [data, loading]);

  // ── In: thay input → span trước khi in, khôi phục sau ──
  const handlePrint = () => {
    const container = htmlContainerRef.current;
    if (!container) return window.print();

    const inputs = container.querySelectorAll("input, textarea");
    const backups = [];
    inputs.forEach((el) => {
      const val = el.value || "";
      const span = document.createElement("span");
      span.setAttribute("data-print-placeholder", "true");
      span.innerText = val;
      span.style.cssText = `
        display: inline;
        border-bottom: 1px dotted #000;
        min-width: 40px;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        word-break: break-word;
      `;
      backups.push({ el, parent: el.parentNode, val });
      el.parentNode.replaceChild(span, el);
    });

    window.print();

    // Khôi phục sau khi print dialog đóng
    backups.forEach(({ el, parent, val }) => {
      const span = parent.querySelector('[data-print-placeholder="true"]');
      if (span) parent.replaceChild(el, span);
      el.value = val;
      if (el.tagName === "TEXTAREA") {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    });
  };

  // ── Export PDF: wrapper A4 chuẩn, font 11pt ──
  const handleExportPdf = () => {
    const element = htmlContainerRef.current;
    if (!element) return alert("Không tìm thấy nội dung!");

    setExporting(true);

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm 15mm 25mm;
      box-sizing: border-box;
      background: #fff;
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
    `;

    const innerStyle = document.createElement("style");
    innerStyle.textContent = `
      .word-document { font-size: 11pt !important; line-height: 1.5 !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
      p { margin: 2px 0 !important; line-height: 1.5 !important; }
      h1, h2, h3 { font-size: 11pt !important; text-align: center !important; margin: 4px 0 !important; }
      .doc-center, p > strong:only-child, p > b:only-child { text-align: center !important; display: block !important; }
      table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 11pt !important; }
      td, th { word-wrap: break-word !important; overflow-wrap: break-word !important; padding: 2px 4px !important; vertical-align: top !important; white-space: normal !important; font-size: 11pt !important; }
      b, strong { font-weight: bold !important; }
      i, em { font-style: italic !important; }
    `;
    wrapper.appendChild(innerStyle);

    const clone = element.cloneNode(true);
    const originalInputs = element.querySelectorAll("input, textarea");
    const clonedInputs = clone.querySelectorAll("input, textarea");

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
        font-size: 11pt;
        line-height: 1.5;
        word-break: break-word;
      `;
      clonedEl.parentNode?.replaceChild(span, clonedEl);
    });

    clone.removeAttribute("style");
    clone.style.cssText = `
      width: 100%;
      font-size: 11pt;
      line-height: 1.5;
      font-family: 'Times New Roman', serif;
      color: #000;
    `;
    wrapper.appendChild(clone);

    const title = data?.info?.title || `bieu-mau-${cleanId}`;

    html2pdf()
      .set({
        margin: 0,
        filename: `${title}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          windowWidth: 1123,
          windowHeight: 1587,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(wrapper)
      .save()
      .finally(() => setExporting(false));
  };

  // ── Lưu ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/submissions/${cleanId}`, { values: valuesRef.current });
      alert("Lưu thành công!");
    } catch {
      alert("Lỗi lưu!");
    } finally {
      setSaving(false);
    }
  };

  // ── Xoá ──
  const handleDeleteSubmission = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn XOÁ VĨNH VIỄN biểu mẫu này không?")) return;
    setDeleting(true);
    try {
      await api.delete(`/submissions/${cleanId}`);
      alert("Đã xoá thành công!");
      navigate(-1);
    } catch {
      alert("Lỗi khi xoá!");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 50 }}>Đang tải...</div>;

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh" }}>

      {/* ===== HEADER ===== */}
      <header className="no-print" style={{
        background: "#fff", padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #ddd", position: "sticky", top: 0, zIndex: 100,
        gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={BS.back} onClick={() => navigate(-1)}>← Quay lại</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#16323a" }}>
              {data?.info?.title || "Chi tiết biểu mẫu"}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              👤 {data?.info?.full_name} &nbsp;·&nbsp;
              🕐 {new Date(data?.info?.submitted_at).toLocaleString("vi-VN")}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={BS.delete} onClick={handleDeleteSubmission} disabled={deleting}>
            {deleting ? "Đang xoá..." : "🗑️ Xoá"}
          </button>
          <button style={BS.save} onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "💾 Lưu"}
          </button>
          <button style={BS.print} onClick={handlePrint}>🖨️ In</button>
          <button style={BS.export} onClick={handleExportPdf} disabled={exporting}>
            {exporting ? "Đang xuất..." : "📄 Tải PDF"}
          </button>
        </div>
      </header>

      {/* ===== NỘI DUNG ===== */}
      <main style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
        <div
          ref={htmlContainerRef}
          id="submission-print-area"
          className="word-document"
          style={{
            width: "100%",
            maxWidth: "900px",
            minHeight: "297mm",
            padding: "20mm 25mm",
            background: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            fontFamily: "'Times New Roman', serif",
            fontSize: "13pt",
            lineHeight: "2",
            boxSizing: "border-box",
          }}
        />
      </main>
    </div>
  );
}

// ── Button styles ──
const BS = {
  back:   { padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#eceff1", color: "#546e7a" },
  delete: { padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#ef4444", color: "#fff" },
  save:   { padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg,#43bfc9,#2196f3)", color: "#fff" },
  print:  { padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg,#78909c,#546e7a)", color: "#fff" },
  export: { padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg,#43a047,#2e7d32)", color: "#fff" },
};