import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import api from "../api";
import * as pdfjs from 'pdfjs-dist';

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

export default function AdminPDFConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [dragging, setDragging] = useState(null);
  const htmlRef = useRef(null);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const workerUrl = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

  const hasPdf = !!form?.template_pdf;
  const hasHtml = !!form?.template_html;

  useEffect(() => {
    api.get(`/forms/${id}`).then((res) => {
      setForm(res.data);
      if (res.data.template_pdf) {
        setPdfUrl(`http://localhost:5000/uploads/${res.data.template_pdf}`);
      }
      const formattedFields = (res.data.fields || []).map(f => ({
        ...f,
        page_index: parseInt(f.page_index) || 0,
        x_pos: parseFloat(f.x_pos) || 0,
        y_pos: parseFloat(f.y_pos) || 0,
        width_size: parseFloat(f.width_size) || 15
      }));
      setFields(formattedFields);
    });
  }, [id]);

  // ── PDF drag handlers ──
  const startDrag = (e, index) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({ index, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
  };

  const onDragging = (e, pageRect, pageIndex) => {
    if (!dragging || dragging.index === null) return;
    const fieldIndex = dragging.index;
    if (fields[fieldIndex].page_index !== pageIndex) return;
    let newX = ((e.clientX - pageRect.left - dragging.offsetX) / pageRect.width) * 100;
    let newY = ((e.clientY - pageRect.top - dragging.offsetY) / pageRect.height) * 100;
    newX = Math.max(0, Math.min(newX, 100 - fields[fieldIndex].width_size));
    newY = Math.max(0, Math.min(newY, 98));
    const updatedFields = [...fields];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], x_pos: newX, y_pos: newY };
    setFields(updatedFields);
  };

  const stopDrag = () => setDragging(null);

  const handlePageClick = (e, pageIndex) => {
    if (!isEditing || dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    const label = prompt("Nhãn field:");
    if (!label) return;
    setFields([...fields, {
      field_label: label,
      field_name: `field_${Date.now()}`,
      page_index: pageIndex,
      x_pos: xPercent,
      y_pos: yPercent,
      width_size: 15,
      field_type: "text"
    }]);
  };

  const saveConfig = async () => {
    try {
      await api.put(`/forms/${id}/coords`, { fields });
      alert("Đã lưu cấu hình thành công!");
    } catch (err) {
      alert("Lỗi khi lưu dữ liệu!");
    }
  };

  // ── PDF renderPage ──
  const renderPage = (props) => (
    <div
      onMouseMove={(e) => onDragging(e, e.currentTarget.getBoundingClientRect(), props.pageIndex)}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}
    >
      {props.canvasLayer.children}
      {props.textLayer.children}
      {props.annotationLayer.children}

      {isEditing && (
        <div
          onClick={(e) => handlePageClick(e, props.pageIndex)}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10, cursor: "crosshair" }}
        />
      )}

      {fields.filter(f => f.page_index === props.pageIndex).map((f) => {
        const realIndex = fields.findIndex(field => field.field_name === f.field_name);
        const isThisDragging = dragging?.index === realIndex;
        return (
          <div
            key={f.field_name}
            onMouseDown={(e) => startDrag(e, realIndex)}
            style={{
              position: "absolute", left: `${f.x_pos}%`, top: `${f.y_pos}%`,
              width: `${f.width_size}%`, height: "26px",
              border: isThisDragging ? "2px solid #007bff" : "2px solid #ff4d4f",
              background: isThisDragging ? "rgba(0,123,255,0.4)" : "rgba(255,77,79,0.4)",
              zIndex: 20, cursor: isEditing ? "move" : "default",
              display: "flex", alignItems: "center", paddingLeft: "5px",
              fontSize: "11px", fontWeight: "bold", borderRadius: "3px",
              pointerEvents: isEditing ? "auto" : "none",
              userSelect: "none", whiteSpace: "nowrap", overflow: "hidden"
            }}
          >
            {f.field_label}
          </div>
        );
      })}
    </div>
  );

  // ── HTML form field labels display ──
  const renderHtmlFieldBadges = () => (
    <div style={{ padding: "20px", background: "#fff", borderRadius: "8px", margin: "20px" }}>
      <div style={{ marginBottom: "16px", color: "#555", fontSize: "13px" }}>
        💡 Form này dùng <b>template HTML</b>. Các fields được tự động nhận diện từ nội dung. 
        Bạn có thể đổi tên nhãn field bên sidebar rồi lưu lại.
      </div>

      {/* Render HTML template */}
      <div
        style={{
          padding: "40px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          background: "#fafafa",
          fontFamily: "'Times New Roman', serif",
          fontSize: "13pt",
          lineHeight: "2",
          position: "relative"
        }}
        dangerouslySetInnerHTML={{ __html: form?.template_html || "" }}
      />
    </div>
  );

  return (
    <div style={styles.container}>
      {/* TOOLBAR */}
      <div style={styles.toolbar}>
        <button onClick={() => navigate("/admin")} style={styles.btnBack}>← Quay lại</button>
        <div style={{ marginLeft: "10px" }}>
          <b style={{ color: "#43bfc9" }}>Cấu hình:</b> {form?.title}
          <span style={{
            marginLeft: "10px", fontSize: "12px", padding: "2px 8px", borderRadius: "10px",
            background: hasPdf ? "#fff3e0" : "#e3f2fd",
            color: hasPdf ? "#e65100" : "#1565c0"
          }}>
            {hasPdf ? "📄 PDF" : "📝 Word/HTML"}
          </span>
        </div>
        {hasPdf && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{ ...styles.btnMode, background: isEditing ? "#ff4d4f" : "#43bfc9" }}
          >
            {isEditing ? "TẮT CHỈNH SỬA" : "BẬT CHỈNH SỬA"}
          </button>
        )}
        <button onClick={saveConfig} style={styles.btnSave}>LƯU CẤU HÌNH</button>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {/* LEFT: PDF viewer hoặc HTML preview */}
        <div style={styles.pdfArea}>
          {hasPdf ? (
            <Worker workerUrl={workerUrl}>
              {pdfUrl && (
                <Viewer
                  fileUrl={pdfUrl}
                  plugins={[defaultLayoutPluginInstance]}
                  renderPage={renderPage}
                  key={fields.length}
                />
              )}
            </Worker>
          ) : hasHtml ? (
            renderHtmlFieldBadges()
          ) : (
            <div style={{ color: "#aaa", textAlign: "center", marginTop: "100px" }}>
              Không có template để hiển thị
            </div>
          )}
        </div>

        {/* SIDEBAR: danh sách fields */}
        <div style={styles.sidebar}>
          <h3 style={{ borderBottom: "1px solid #ddd", paddingBottom: "10px", margin: "0 0 12px 0" }}>
            Fields ({fields.length})
          </h3>

          {fields.length === 0 && (
            <p style={{ color: "#aaa", fontSize: "13px" }}>Chưa có field nào.</p>
          )}

          <div style={{ overflowY: "auto", height: "calc(100% - 60px)" }}>
            {fields.map((f, i) => (
              <div key={i} style={styles.sideItem}>
                {/* Tên label — có thể sửa */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <input
                    value={f.field_label}
                    onChange={(e) => {
                      const updated = [...fields];
                      updated[i] = { ...updated[i], field_label: e.target.value };
                      setFields(updated);
                    }}
                    style={{
                      fontWeight: "bold", fontSize: "13px", color: "#333",
                      border: "none", borderBottom: "1px solid #ccc",
                      outline: "none", background: "transparent", width: "160px"
                    }}
                  />
                  <button
                    onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                    style={{ color: "red", border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: "12px" }}
                  >
                    Xóa
                  </button>
                </div>

                {/* field_name (readonly) */}
                <div style={{ fontSize: "10px", color: "#999", marginBottom: "4px" }}>
                  key: {f.field_name}
                </div>

                {/* Độ rộng (chỉ cho PDF) */}
                {hasPdf && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <label style={{ fontSize: "12px", color: "#666" }}>Độ rộng (%):</label>
                    <input
                      type="number"
                      value={f.width_size}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = [...fields];
                        updated[i] = { ...updated[i], width_size: Math.min(val, 100) };
                        setFields(updated);
                      }}
                      style={{ width: "60px", padding: "2px 5px", border: "1px solid #ccc", borderRadius: "3px" }}
                    />
                  </div>
                )}

                <div style={{ fontSize: "10px", color: "#999" }}>
                  {hasPdf ? `Trang: ${f.page_index + 1} | X: ${Math.round(f.x_pos)}% | Y: ${Math.round(f.y_pos)}%` : `Type: ${f.field_type || "text"}`}
                </div>
              </div>
            ))}
          </div>

          {/* Thêm field mới (cho HTML form) */}
          {hasHtml && !hasPdf && (
            <button
              onClick={() => {
                const label = prompt("Nhãn field mới:");
                if (!label) return;
                setFields([...fields, {
                  field_label: label,
                  field_name: `field_${Date.now()}`,
                  page_index: 0,
                  x_pos: 0,
                  y_pos: 0,
                  width_size: 150,
                  field_type: "text",
                  is_required: 0
                }]);
              }}
              style={{
                marginTop: "12px", width: "100%", padding: "8px",
                background: "#43bfc9", color: "#fff", border: "none",
                borderRadius: "6px", cursor: "pointer", fontWeight: "600"
              }}
            >
              + Thêm field
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "Arial, sans-serif" },
  toolbar: { height: "60px", background: "#1a1a1a", display: "flex", alignItems: "center", padding: "0 20px", gap: "15px", color: "white", flexShrink: 0 },
  main: { display: "flex", flex: 1, overflow: "hidden" },
  pdfArea: { flex: 1, overflow: "auto", background: "#525659" },
  sidebar: { width: "280px", padding: "15px", background: "#f8f9fa", borderLeft: "1px solid #ddd", display: "flex", flexDirection: "column" },
  sideItem: { padding: "12px", borderBottom: "1px solid #ddd", background: "#fff", marginBottom: "8px", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  btnMode: { border: "none", padding: "8px 15px", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  btnSave: { background: "#28a745", border: "none", padding: "8px 15px", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginLeft: "auto" },
  btnBack: { background: "#444", color: "white", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }
};