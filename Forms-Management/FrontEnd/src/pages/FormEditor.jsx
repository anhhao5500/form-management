import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import PDFUploadModal from "../components/PDFUploadModal";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FIELD_ATTR = "data-editable-field";
const FIELD_TYPE_ATTR = "data-field-type";
const FIELD_NAME_ATTR = "data-field";

// ─────────────────────────────────────────────────────────────
// HTML CONVERTERS
// ─────────────────────────────────────────────────────────────
function convertToEditable(html) {
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("input").forEach((el) => {
    const isNum = el.getAttribute("data-field-type") === "number" || el.getAttribute("inputmode") === "numeric" || el.type === "number";
    const span = makeEditableSpan(doc, el.getAttribute("name") || `f_${Date.now()}`, isNum ? "number" : "text");
    span.textContent = el.getAttribute("value") || "";
    el.parentNode.replaceChild(span, el);
  });
  doc.querySelectorAll("textarea").forEach((el) => {
    const div = makeEditableDiv(doc, el.getAttribute("name") || `f_${Date.now()}`);
    div.textContent = el.textContent || "";
    el.parentNode.replaceChild(div, el);
  });
  const wordDoc = doc.querySelector(".word-document");
  return wordDoc ? wordDoc.innerHTML : doc.body.innerHTML;
}

function makeEditableSpan(doc, name, type) {
  const span = doc.createElement("span");
  span.setAttribute(FIELD_ATTR, "true");
  span.setAttribute(FIELD_NAME_ATTR, name);
  span.setAttribute(FIELD_TYPE_ATTR, type);
  span.setAttribute("contenteditable", "true");
  return span;
}

function makeEditableDiv(doc, name) {
  const div = doc.createElement("div");
  div.setAttribute(FIELD_ATTR, "true");
  div.setAttribute(FIELD_NAME_ATTR, name);
  div.setAttribute(FIELD_TYPE_ATTR, "text");
  div.setAttribute("contenteditable", "true");
  return div;
}

function convertBackToForm(editorEl) {
  if (!editorEl) return "";
  const clone = editorEl.cloneNode(true);
  clone.querySelectorAll("[data-delete-btn]").forEach((el) => el.remove());
  clone.querySelectorAll("[data-img-overlay]").forEach((el) => el.remove());
  clone.querySelectorAll("img.img-selected").forEach((el) => el.classList.remove("img-selected"));

  clone.querySelectorAll(`[${FIELD_ATTR}]`).forEach((el) => {
    const name    = el.getAttribute(FIELD_NAME_ATTR) || `field_${Date.now()}`;
    const type    = el.getAttribute(FIELD_TYPE_ATTR) || "text";
    const isBlock = el.tagName === "DIV";
    const textVal = (el.textContent || "").replace(/\u200B/g, "").trim();

    if (isBlock) {
      const ta = document.createElement("textarea");
      ta.name = name; ta.rows = 1;
      ta.setAttribute("oninput", "this.style.height='auto';this.style.height=this.scrollHeight+'px'");
      ta.style.cssText = "border:none;border-bottom:1px dotted #000;min-width:200px;width:100%;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:block;resize:none;overflow:hidden;padding:0;margin:0;line-height:inherit;box-sizing:border-box;";
      ta.textContent = textVal;
      el.parentNode.replaceChild(ta, el);
    } else if (type === "number") {
      const inp = document.createElement("input");
      inp.type = "text"; inp.name = name; inp.value = textVal;
      inp.setAttribute("inputmode", "numeric");
      inp.setAttribute("data-field-type", "number");
      inp.setAttribute("data-date-field", "1");
      inp.setAttribute("oninput", "this.value=this.value.replace(/[^0-9]/g,'')");
      inp.setAttribute("onkeypress", "return /[0-9]/.test(event.key)");
      inp.style.cssText = "border:none;border-bottom:1px dotted #000;width:80px;min-width:40px;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:inline-block;vertical-align:baseline;text-align:center;padding:0 2px;";
      el.parentNode.replaceChild(inp, el);
    } else {
      const inp = document.createElement("input");
      inp.type = "text"; inp.name = name; inp.value = textVal;
      inp.setAttribute("data-field-type", "text");
      const charCount = Math.max(textVal.length, 6);
      const autoWidth = Math.min(Math.max(charCount * 10, 60), 350);
      inp.style.cssText = `border:none;border-bottom:1px dotted #000;width:${autoWidth}px;min-width:60px;max-width:400px;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:inline-block;vertical-align:baseline;padding:0 2px;box-sizing:border-box;`;
      el.parentNode.replaceChild(inp, el);
    }
  });
  return clone.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// INSERT FIELD
// ─────────────────────────────────────────────────────────────
function insertFieldAtCursor(type, savedRange) {
  const el = document.createElement("span");
  el.setAttribute(FIELD_ATTR, "true");
  el.setAttribute(FIELD_NAME_ATTR, `f_${Date.now()}`);
  el.setAttribute(FIELD_TYPE_ATTR, type === "number" ? "number" : "text");
  el.setAttribute("contenteditable", "true");
  el.textContent = "\u200B";
  const sel = window.getSelection();
  if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(el);
  const after = document.createRange();
  after.setStartAfter(el); after.collapse(true);
  sel.removeAllRanges(); sel.addRange(after);
}

// ─────────────────────────────────────────────────────────────
// IMAGE RESIZE OVERLAY
// ─────────────────────────────────────────────────────────────
const HANDLE_CURSORS = {
  nw:"nw-resize", n:"n-resize", ne:"ne-resize",
  w:"w-resize", e:"e-resize",
  sw:"sw-resize", s:"s-resize", se:"se-resize",
};

function useImageResize(editorRef) {
  const currentImgRef = useRef(null);
  const overlayElRef  = useRef(null);
  const panelElRef    = useRef(null);
  const resizeDragRef = useRef(null);
  const panelDragRef  = useRef(null);
  const [selected, setSelected] = useState(false);

  const removeOverlay = useCallback(() => {
    if (overlayElRef.current) { overlayElRef.current.remove(); overlayElRef.current = null; }
    if (panelElRef.current)   { panelElRef.current.remove();   panelElRef.current   = null; }
    if (currentImgRef.current) currentImgRef.current.classList.remove("img-selected");
    currentImgRef.current = null;
    setSelected(false);
  }, []);

  const refreshOverlay = useCallback(() => {
    const img = currentImgRef.current;
    const ov  = overlayElRef.current;
    if (!img || !ov) return;
    ov.style.left   = `${img.offsetLeft}px`;
    ov.style.top    = `${img.offsetTop}px`;
    ov.style.width  = `${img.offsetWidth}px`;
    ov.style.height = `${img.offsetHeight}px`;
  }, []);

  const buildPanel = useCallback((img) => {
    if (panelElRef.current) { panelElRef.current.remove(); panelElRef.current = null; }
    const panel = document.createElement("div");
    panel.setAttribute("data-img-overlay", "true");
    panel.style.cssText = "position:fixed;z-index:9997;background:#1a2332;border:1px solid #2d3f55;border-radius:12px;padding:12px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.45);display:flex;flex-direction:column;gap:10px;min-width:360px;user-select:none;cursor:default;";
    const initLeft = Math.max(8, (window.innerWidth - 380) / 2);
    panel.style.left = `${initLeft}px`;
    panel.style.top  = `${window.innerHeight - 220}px`;

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;cursor:grab;padding-bottom:8px;border-bottom:1px solid #2d3f55;";
    header.innerHTML = `<span style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:1px;text-transform:uppercase;">🖼️ Chỉnh sửa ảnh</span><span style="font-size:10px;color:#475569;font-family:sans-serif;">⠿ kéo để di chuyển</span>`;
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      panelDragRef.current = { startX: e.clientX, startY: e.clientY, panelLeft: parseInt(panel.style.left), panelTop: parseInt(panel.style.top) };
      header.style.cursor = "grabbing";
    });
    panel.appendChild(header);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;align-items:flex-end;";
    const mkField = (label, dataAttr, defaultVal) => {
      const wrap = document.createElement("div"); wrap.style.flex = "1";
      const lbl  = document.createElement("div");
      lbl.style.cssText = "font-size:11px;color:#94a3b8;margin-bottom:4px;"; lbl.textContent = label;
      const inp = document.createElement("input");
      inp.setAttribute(dataAttr, "true");
      inp.type = "text"; inp.value = defaultVal;
      inp.style.cssText = "width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;border:1px solid #2d3f55;background:#0f1923;color:#e2e8f0;font-size:13px;outline:none;font-family:sans-serif;";
      inp.addEventListener("input", () => {
        const val = inp.value.replace(/\D/g, "");
        if (dataAttr === "data-panel-w") img.style.width  = val ? `${val}px` : "auto";
        if (dataAttr === "data-panel-h") img.style.height = val ? `${val}px` : "auto";
        refreshOverlay();
      });
      wrap.appendChild(lbl); wrap.appendChild(inp); return wrap;
    };
    row.appendChild(mkField("Rộng (px)", "data-panel-w", String(img.style.width ? parseInt(img.style.width) : img.naturalWidth || 200)));
    row.appendChild(mkField("Cao (px)",  "data-panel-h", String(img.style.height ? parseInt(img.style.height) : "")));

    const alignWrap = document.createElement("div"); alignWrap.style.flex = "1";
    const alignLbl  = document.createElement("div");
    alignLbl.style.cssText = "font-size:11px;color:#94a3b8;margin-bottom:4px;"; alignLbl.textContent = "Căn lề";
    const sel = document.createElement("select");
    sel.style.cssText = "width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;border:1px solid #2d3f55;background:#0f1923;color:#e2e8f0;font-size:13px;outline:none;";
    ["none","left","center","right"].forEach((v) => {
      const opt = document.createElement("option"); opt.value = v;
      opt.textContent = { none:"Mặc định", left:"Trái", center:"Giữa", right:"Phải" }[v];
      if ((img.parentElement?.style.textAlign || "none") === v) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => { if (img.parentElement) img.parentElement.style.textAlign = sel.value === "none" ? "" : sel.value; });
    alignWrap.appendChild(alignLbl); alignWrap.appendChild(sel);
    row.appendChild(alignWrap);
    panel.appendChild(row);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:11px;color:#475569;font-family:sans-serif;";
    hint.textContent = "💡 Giữ Shift khi kéo handle để giữ tỷ lệ ảnh";
    panel.appendChild(hint);

    const btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;gap:8px;";
    const mkBtn = (text, bg, color, border, fn) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = text;
      b.style.cssText = `flex:1;padding:7px 0;background:${bg};color:${color};border:1px solid ${border};border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;font-family:sans-serif;`;
      b.addEventListener("click", fn); return b;
    };
    btnRow.appendChild(mkBtn("🗑️ Xóa ảnh", "#7f1d1d", "#fca5a5", "#991b1b", () => {
      if (img.parentElement?.children.length === 1 && img.parentElement.textContent.trim() === "") img.parentElement.remove();
      else img.remove();
      removeOverlay();
    }));
    btnRow.appendChild(mkBtn("✓ Xong", "#1e3a5f", "#93c5fd", "#1d4ed8", () => removeOverlay()));
    panel.appendChild(btnRow);
    document.body.appendChild(panel);
    panelElRef.current = panel;
  }, [removeOverlay, refreshOverlay]);

  const buildOverlay = useCallback((img) => {
    removeOverlay();
    img.classList.add("img-selected");
    currentImgRef.current = img;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-img-overlay", "true");
    wrapper.style.cssText = "position:absolute;pointer-events:none;z-index:500;";
    wrapper.style.left   = `${img.offsetLeft}px`;
    wrapper.style.top    = `${img.offsetTop}px`;
    wrapper.style.width  = `${img.offsetWidth}px`;
    wrapper.style.height = `${img.offsetHeight}px`;
    Object.keys(HANDLE_CURSORS).forEach((dir) => {
      const h = document.createElement("div");
      h.setAttribute("data-img-handle", dir);
      const SIZE=8, HALF=SIZE/2;
      const base = `position:absolute;width:${SIZE}px;height:${SIZE}px;background:#fff;border:2px solid #7c3aed;border-radius:2px;z-index:10;pointer-events:all;cursor:${HANDLE_CURSORS[dir]};`;
      const pos = { nw:`top:-${HALF}px;left:-${HALF}px;`, n:`top:-${HALF}px;left:calc(50% - ${HALF}px);`, ne:`top:-${HALF}px;right:-${HALF}px;`, w:`top:calc(50% - ${HALF}px);left:-${HALF}px;`, e:`top:calc(50% - ${HALF}px);right:-${HALF}px;`, sw:`bottom:-${HALF}px;left:-${HALF}px;`, s:`bottom:-${HALF}px;left:calc(50% - ${HALF}px);`, se:`bottom:-${HALF}px;right:-${HALF}px;` };
      h.style.cssText = base + pos[dir];
      h.addEventListener("mousedown", (e) => {
        e.preventDefault(); e.stopPropagation();
        resizeDragRef.current = { dir, img, startX: e.clientX, startY: e.clientY, startW: img.offsetWidth, startH: img.offsetHeight, naturalRatio: img.naturalWidth / (img.naturalHeight || 1) };
      });
      wrapper.appendChild(h);
    });
    img.parentElement.style.position = "relative";
    img.parentElement.appendChild(wrapper);
    overlayElRef.current = wrapper;
    buildPanel(img);
    setSelected(true);
  }, [removeOverlay, buildPanel]);

  useEffect(() => {
    const onMove = (e) => {
      // resize drag
      if (resizeDragRef.current) {
        const { dir, img, startX, startY, startW, startH, naturalRatio } = resizeDragRef.current;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        let w = startW, h = startH;
        const lock = e.shiftKey;
        if (dir.includes("e")) w = Math.max(30, startW + dx);
        if (dir.includes("w")) w = Math.max(30, startW - dx);
        if (dir.includes("s")) h = Math.max(30, startH + dy);
        if (dir.includes("n")) h = Math.max(30, startH - dy);
        if (lock) {
          if (dir.includes("e") || dir.includes("w")) h = Math.round(w / naturalRatio);
          else w = Math.round(h * naturalRatio);
        }
        img.style.width  = `${w}px`;
        img.style.height = h === startH && !lock ? "auto" : `${h}px`;
        if (panelElRef.current) {
          const wI = panelElRef.current.querySelector("[data-panel-w]");
          const hI = panelElRef.current.querySelector("[data-panel-h]");
          if (wI) wI.value = Math.round(w);
          if (hI) hI.value = lock ? Math.round(h) : "";
        }
        refreshOverlay();
      }
      // panel drag
      if (panelDragRef.current) {
        const { startX, startY, panelLeft, panelTop } = panelDragRef.current;
        const panel = panelElRef.current; if (!panel) return;
        panel.style.left = `${Math.max(0, Math.min(panelLeft + e.clientX - startX, window.innerWidth  - panel.offsetWidth))}px`;
        panel.style.top  = `${Math.max(0, Math.min(panelTop  + e.clientY - startY, window.innerHeight - panel.offsetHeight))}px`;
      }
    };
    const onUp = () => {
      resizeDragRef.current = null;
      panelDragRef.current  = null;
      if (panelElRef.current) { const h = panelElRef.current.querySelector("div"); if (h) h.style.cursor = "grab"; }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [refreshOverlay]);

  useEffect(() => {
    const editor = editorRef.current; if (!editor) return;
    const onDown = (e) => {
      const img = e.target.closest("img");
      if (img && editor.contains(img)) { e.stopPropagation(); buildOverlay(img); return; }
      const panel = panelElRef.current;
      const ov    = overlayElRef.current;
      if (panel?.contains(e.target) || ov?.contains(e.target)) return;
      removeOverlay();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editorRef, buildOverlay, removeOverlay]);

  return { selected };
}

// ─────────────────────────────────────────────────────────────
// IMAGE MODAL
// ─────────────────────────────────────────────────────────────
function ImageModal({ isOpen, onClose, onInsert }) {
  const [tab, setTab]       = useState("upload");
  const [url, setUrl]       = useState("");
  const [width, setWidth]   = useState("200");
  const [height, setHeight] = useState("");
  const [align, setAlign]   = useState("none");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const reset = () => { setUrl(""); setWidth("200"); setHeight(""); setAlign("none"); setPreview(null); setTab("upload"); if (fileRef.current) fileRef.current.value = ""; };
  const handleClose = () => { reset(); onClose(); };
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Chỉ chấp nhận file ảnh!"); return; }
    if (file.size > 5*1024*1024) { alert("File ảnh tối đa 5MB!"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };
  const handleInsert = () => {
    const src = tab === "upload" ? preview : url.trim();
    if (!src) { alert("Vui lòng chọn ảnh hoặc nhập URL!"); return; }
    onInsert({ src, width: width || "200", height: height || "", align });
    handleClose();
  };
  if (!isOpen) return null;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={{ background:"#fff",borderRadius:16,width:520,maxWidth:"95vw",boxShadow:"0 24px 64px rgba(0,0,0,0.25)",display:"flex",flexDirection:"column",overflow:"hidden",maxHeight:"90vh" }}>
        <div style={{ padding:"18px 22px 14px",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontWeight:800,fontSize:17,color:"#12323a" }}>🖼️ Chèn ảnh vào biểu mẫu</div>
          <button onClick={handleClose} style={{ background:"#f1f5f9",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:16,color:"#64748b" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto",flex:1 }}>
          <div style={{ display:"flex",borderBottom:"1px solid #e5e7eb",background:"#f8fafb" }}>
            {[{key:"upload",label:"📁 Tải từ máy tính"},{key:"url",label:"🔗 Dán URL ảnh"}].map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); }}
                style={{ flex:1,padding:"12px 0",border:"none",cursor:"pointer",fontWeight:tab===t.key?700:500,fontSize:13,background:tab===t.key?"#fff":"transparent",color:tab===t.key?"#2563eb":"#6b7280",borderBottom:tab===t.key?"2px solid #2563eb":"2px solid transparent" }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ padding:"20px 22px" }}>
            {tab === "upload" && (
              <div onClick={() => fileRef.current?.click()}
                style={{ border:"2px dashed #d1d5db",borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"#fafafa" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor="#7c3aed"; e.currentTarget.style.background="#faf5ff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.background="#fafafa"; }}>
                <div style={{ fontSize:40,marginBottom:8 }}>📷</div>
                <div style={{ fontWeight:600,color:"#374151",marginBottom:4 }}>Click để chọn ảnh</div>
                <div style={{ fontSize:12,color:"#9ca3af" }}>PNG, JPG, GIF, WEBP — tối đa 5MB</div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileChange} />
              </div>
            )}
            {tab === "url" && (
              <div>
                <label style={IS.lbl}>URL ảnh</label>
                <input value={url} onChange={(e) => { setUrl(e.target.value); setPreview(e.target.value.trim()||null); }}
                  placeholder="https://example.com/image.png" style={{ ...IS.inp,width:"100%",boxSizing:"border-box" }} />
              </div>
            )}
            {preview && (
              <div style={{ marginTop:16,textAlign:"center" }}>
                <div style={{ fontSize:12,color:"#6b7280",marginBottom:8,fontWeight:600 }}>Xem trước:</div>
                <div style={{ border:"1px solid #e5e7eb",borderRadius:10,padding:12,background:"#f9fafb",display:"inline-block",maxWidth:"100%" }}>
                  <img src={preview} alt="preview" onError={() => setPreview(null)} style={{ maxWidth:"100%",maxHeight:180,borderRadius:6,objectFit:"contain" }} />
                </div>
              </div>
            )}
            <div style={{ marginTop:20 }}>
              <div style={{ fontWeight:700,fontSize:13,color:"#374151",marginBottom:12 }}>📐 Kích thước & Căn lề ban đầu</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
                <div><label style={IS.lbl}>Chiều rộng (px)</label><input value={width} onChange={(e) => setWidth(e.target.value.replace(/\D/g,""))} placeholder="200" style={{ ...IS.inp,width:"100%",boxSizing:"border-box" }} /></div>
                <div><label style={IS.lbl}>Chiều cao (px)</label><input value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g,""))} placeholder="tự động" style={{ ...IS.inp,width:"100%",boxSizing:"border-box" }} /></div>
                <div>
                  <label style={IS.lbl}>Căn lề</label>
                  <select value={align} onChange={(e) => setAlign(e.target.value)} style={{ ...IS.inp,width:"100%",boxSizing:"border-box" }}>
                    <option value="none">Mặc định</option><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding:"14px 22px",borderTop:"1px solid #f0f0f0",display:"flex",gap:10,justifyContent:"flex-end",background:"#f8fafb" }}>
          <button onClick={handleClose} style={IS.btnCancel}>Hủy</button>
          <button onClick={handleInsert} style={IS.btnOk}>✅ Chèn ảnh</button>
        </div>
      </div>
    </div>
  );
}
const IS = {
  lbl: { display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5 },
  inp: { padding:"8px 10px",borderRadius:7,border:"1px solid #d1d5db",fontSize:13,outline:"none",background:"#fff" },
  btnCancel: { padding:"9px 20px",background:"#f1f5f9",color:"#374151",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13 },
  btnOk: { padding:"9px 22px",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,boxShadow:"0 4px 12px rgba(124,58,237,0.3)" },
};

// ─────────────────────────────────────────────────────────────
// FIELD OVERLAY
// ─────────────────────────────────────────────────────────────
function useFieldOverlay(editorRef) {
  const overlayRef      = useRef(null);
  const currentFieldRef = useRef(null);
  const hideTimerRef    = useRef(null);

  const createOverlay = useCallback(() => {
    if (overlayRef.current) return;
    const div = document.createElement("div");
    div.setAttribute("data-delete-btn", "true");
    div.style.cssText = "position:fixed;z-index:9999;display:flex;align-items:center;gap:6px;background:#1e293b;border-radius:8px;padding:4px 8px;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:auto;user-select:none;";
    const lbl = document.createElement("span"); lbl.style.cssText="font-size:11px;color:#94a3b8;font-family:sans-serif;white-space:nowrap;"; lbl.textContent="Ô nhập liệu"; div.appendChild(lbl);
    const badge = document.createElement("span"); badge.setAttribute("data-type-badge","true"); badge.style.cssText="font-size:10px;font-weight:700;font-family:sans-serif;padding:1px 6px;border-radius:4px;color:#fff;"; div.appendChild(badge);
    const btn = document.createElement("button"); btn.type="button"; btn.textContent="✕ Xóa";
    btn.style.cssText="border:none;background:#ef4444;color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;padding:3px 8px;border-radius:5px;cursor:pointer;line-height:1.4;";
    btn.onclick = (e) => { e.stopPropagation(); if(currentFieldRef.current?.parentNode) currentFieldRef.current.parentNode.removeChild(currentFieldRef.current); currentFieldRef.current=null; hideOverlay(); };
    div.appendChild(btn); document.body.appendChild(div); overlayRef.current=div;
  }, []);

  const showOverlay = useCallback((fieldEl) => {
    clearTimeout(hideTimerRef.current); createOverlay(); currentFieldRef.current=fieldEl;
    const type=fieldEl.getAttribute(FIELD_TYPE_ATTR)||"text";
    const badge=overlayRef.current.querySelector("[data-type-badge]");
    if (badge) { badge.textContent=type==="number"?"123":"Aa"; badge.style.background=type==="number"?"#f97316":"#3b82f6"; }
    const rect=fieldEl.getBoundingClientRect();
    const ov=overlayRef.current; ov.style.opacity="1"; ov.style.display="flex";
    requestAnimationFrame(() => {
      let left=rect.left+rect.width/2-ov.offsetWidth/2;
      let top=rect.top-ov.offsetHeight-6;
      left=Math.max(8,Math.min(left,window.innerWidth-ov.offsetWidth-8));
      if (top<8) top=rect.bottom+6;
      ov.style.left=`${left}px`; ov.style.top=`${top}px`;
    });
  }, [createOverlay]);

  const hideOverlay = useCallback((delay=0) => {
    hideTimerRef.current=setTimeout(() => {
      if (overlayRef.current) { overlayRef.current.style.display="none"; overlayRef.current.style.opacity="0"; }
      currentFieldRef.current=null;
    }, delay);
  }, []);

  useEffect(() => {
    const editor=editorRef.current; if (!editor) return;
    const onOver=(e) => { const f=e.target.closest(`[${FIELD_ATTR}]`); if(f){ clearTimeout(hideTimerRef.current); showOverlay(f); } };
    const onOut=(e) => { const f=e.target.closest(`[${FIELD_ATTR}]`); if(f){ const to=e.relatedTarget; const ov=overlayRef.current; if(ov&&(ov===to||ov.contains(to)))return; hideOverlay(200); } };
    editor.addEventListener("mouseover",onOver); editor.addEventListener("mouseout",onOut);
    createOverlay();
    if (overlayRef.current) {
      overlayRef.current.addEventListener("mouseenter",()=>clearTimeout(hideTimerRef.current));
      overlayRef.current.addEventListener("mouseleave",()=>hideOverlay(200));
    }
    return () => {
      editor.removeEventListener("mouseover",onOver); editor.removeEventListener("mouseout",onOut);
      overlayRef.current?.remove(); overlayRef.current=null;
    };
  }, [editorRef,showOverlay,hideOverlay,createOverlay]);
}

// ─────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────
function SimpleToolbar({ onInsertField, onOpenImageModal }) {
  const exec=(cmd,val)=>document.execCommand(cmd,false,val||null);
  const FONTS=["Times New Roman","Arial","Calibri","Georgia","Verdana","Tahoma","Courier New"];
  const COLORS=["#000000","#374151","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#dc2626","#16a34a","#1d4ed8","#ffffff"];
  const HIGHLIGHTS=["#fef08a","#bbf7d0","#bfdbfe","#fecaca","#f5d0fe"];
  return (
    <div style={{ background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"6px 12px",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display:"flex",flexWrap:"wrap",gap:2,alignItems:"center",marginBottom:5 }}>
        <TBtn title="Hoàn tác" onClick={()=>exec("undo")}>↩</TBtn>
        <TBtn title="Làm lại"  onClick={()=>exec("redo")}>↪</TBtn><Sep />
        <select defaultValue="Times New Roman" onChange={(e)=>exec("fontName",e.target.value)} style={selSt}>{FONTS.map((f)=><option key={f} value={f}>{f}</option>)}</select>
        <select defaultValue="3" onChange={(e)=>exec("fontSize",e.target.value)} style={{...selSt,width:68}}>
          <option value="1">8pt</option><option value="2">10pt</option><option value="3">12pt</option><option value="4">14pt</option><option value="5">18pt</option><option value="6">24pt</option><option value="7">36pt</option>
        </select><Sep />
        <TBtn title="Đậm (Ctrl+B)"       onClick={()=>exec("bold")}><strong>B</strong></TBtn>
        <TBtn title="Nghiêng (Ctrl+I)"   onClick={()=>exec("italic")}><em>I</em></TBtn>
        <TBtn title="Gạch chân (Ctrl+U)" onClick={()=>exec("underline")}><u>U</u></TBtn>
        <TBtn title="Gạch ngang"          onClick={()=>exec("strikeThrough")}><s>S</s></TBtn><Sep />
        <TBtn title="Căn trái"   onClick={()=>exec("justifyLeft")}>≡</TBtn>
        <TBtn title="Căn giữa"   onClick={()=>exec("justifyCenter")}>⊟</TBtn>
        <TBtn title="Căn phải"   onClick={()=>exec("justifyRight")}><span style={{transform:"scaleX(-1)",display:"inline-block"}}>≡</span></TBtn>
        <TBtn title="Căn đều"    onClick={()=>exec("justifyFull")}>☰</TBtn><Sep />
        <TBtn title="Danh sách"    onClick={()=>exec("insertUnorderedList")}>•≡</TBtn>
        <TBtn title="Danh sách số" onClick={()=>exec("insertOrderedList")}>1≡</TBtn><Sep />
        <TBtn title="Tăng thụt lề" onClick={()=>exec("indent")}>→|</TBtn>
        <TBtn title="Giảm thụt lề" onClick={()=>exec("outdent")}>|←</TBtn><Sep />
        <TBtn title="Xóa định dạng" onClick={()=>exec("removeFormat")}>🧹</TBtn>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:3,alignItems:"center" }}>
        <span style={{ fontSize:11,color:"#6b7280",marginRight:2 }}>Màu chữ:</span>
        {COLORS.map((c)=><button key={c} type="button" title={c} onClick={()=>exec("foreColor",c)} style={{ width:17,height:17,borderRadius:3,border:"1px solid #e5e7eb",background:c,cursor:"pointer" }} />)}
        <Sep />
        <span style={{ fontSize:11,color:"#6b7280",marginRight:2 }}>Tô màu:</span>
        {HIGHLIGHTS.map((c)=><button key={c} type="button" title={c} onClick={()=>exec("hiliteColor",c)} style={{ width:20,height:20,borderRadius:4,border:"1px solid #e5e7eb",background:c,cursor:"pointer" }} />)}
        <Sep />
        <button type="button" title="Chèn ảnh" onClick={onOpenImageModal}
          style={{ display:"inline-flex",alignItems:"center",gap:6,height:26,padding:"0 12px",border:"1.5px solid #7c3aed",borderRadius:6,cursor:"pointer",background:"#f5f3ff",color:"#7c3aed",fontSize:12,fontWeight:700,fontFamily:"sans-serif" }}
          onMouseEnter={(e)=>{ e.currentTarget.style.background="#ede9fe"; }}
          onMouseLeave={(e)=>{ e.currentTarget.style.background="#f5f3ff"; }}>
          🖼️ Chèn ảnh
        </button><Sep />
        <span style={{ fontSize:11,color:"#374151",fontWeight:600,marginRight:4 }}>Chèn ô nhập:</span>
        <button type="button" title="Ô chữ"  onClick={()=>onInsertField("text")}   style={fieldBtnSt("#3b82f6")}><span>Aa</span> Ô chữ</button>
        <button type="button" title="Ô số"   onClick={()=>onInsertField("number")} style={fieldBtnSt("#f97316")}><span>123</span> Ô số</button>
        <span style={{ fontSize:11,color:"#9ca3af",marginLeft:6,fontStyle:"italic" }}>💡 Hover ô → xóa · Click ảnh → chỉnh · Shift+kéo = giữ tỷ lệ</span>
      </div>
    </div>
  );
}
function fieldBtnSt(color) { return { display:"inline-flex",alignItems:"center",gap:5,height:26,padding:"0 10px",border:`1.5px solid ${color}`,borderRadius:6,cursor:"pointer",background:`${color}18`,color,fontSize:12,fontWeight:700,fontFamily:"sans-serif" }; }
function TBtn({ onClick, title, children }) {
  return <button type="button" title={title} onClick={onClick}
    style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:26,padding:"0 3px",border:"none",borderRadius:4,cursor:"pointer",background:"transparent",color:"#374151",fontSize:13 }}
    onMouseEnter={(e)=>e.currentTarget.style.background="#f3f4f6"}
    onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>{children}</button>;
}
const Sep = () => <span style={{ width:1,height:20,background:"#d1d5db",margin:"0 3px",display:"inline-block" }} />;
const selSt = { height:26,padding:"0 4px",borderRadius:4,border:"1px solid #d1d5db",fontSize:12,background:"#fff",cursor:"pointer",width:140,color:"#374151" };

// ─────────────────────────────────────────────────────────────
// WORD RULER
// ─────────────────────────────────────────────────────────────
function WordRuler({ value, onChange }) {
  const dragRef = useRef(null);
  const clamp   = (n, min, max) => Math.max(min, Math.min(max, n));
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const { key, startValue, startX } = dragRef.current;
      const dx = e.clientX - startX;
      let next = { ...value, [key]: Math.round(startValue + dx) };
      next.left  = clamp(next.left,  0, 200);
      next.right = clamp(next.right, 0, 200);
      next.first = clamp(next.first, -60, 180);
      if (next.left + next.right > 300) next.right = Math.max(0, 300 - next.left);
      onChange(next);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onChange, value]);
  const startDrag = (key) => (e) => { e.preventDefault(); dragRef.current = { key, startValue:value[key], startX:e.clientX }; };
  const Handle = ({ dir, x, color }) => (
    <div onMouseDown={startDrag(dir)} title={dir}
      style={{ position:"absolute",left:x,top:1,width:14,height:24,transform:"translateX(-50%)",cursor:"ew-resize",userSelect:"none",zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",pointerEvents:"auto" }}>
      <div style={{ width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`8px solid ${color}` }} />
      <div style={{ width:10,height:12,marginTop:-1,borderRadius:3,background:color,boxShadow:"0 1px 3px rgba(0,0,0,0.18)" }} />
    </div>
  );
  return (
    <div style={{ background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"6px 12px 10px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",flexShrink:0 }}>
      <div style={{ fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600 }}>Thanh căn chỉnh</div>
      <div style={{ position:"relative",height:30,border:"1px solid #dbe2ea",borderRadius:9,background:"linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:0,left:0,right:0,height:30,background:"repeating-linear-gradient(to right,transparent 0,transparent 9px,rgba(148,163,184,0.28) 10px),repeating-linear-gradient(to right,transparent 0,transparent 49px,rgba(148,163,184,0.38) 50px)" }} />
        <Handle dir="left"  x={value.left}              color="#2563eb" />
        <Handle dir="first" x={value.left + value.first} color="#7c3aed" />
        <div onMouseDown={startDrag("right")}
          style={{ position:"absolute",right:`${value.right}px`,top:1,width:14,height:24,cursor:"ew-resize",userSelect:"none",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center" }}>
          <div style={{ width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"8px solid #f97316" }} />
          <div style={{ width:10,height:12,marginTop:-1,borderRadius:3,background:"#f97316" }} />
        </div>
      </div>
      <div style={{ display:"flex",gap:12,marginTop:8,fontSize:12,color:"#6b7280" }}>
        <span>Lề trái: {value.left}px</span>
        <span>Thụt đầu dòng: {value.first}px</span>
        <span>Lề phải: {value.right}px</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ★ MÀN HÌNH CHỌN PHƯƠNG THỨC TẠO BIỂU MẪU
// ─────────────────────────────────────────────────────────────
function ChooseModeScreen({ onChoose }) {
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();

  const cards = [
    {
      key: "create",
      icon: "✏️",
      title: "Tự tạo biểu mẫu",
      desc: "Soạn thảo biểu mẫu từ đầu bằng trình soạn thảo trực quan. Thêm văn bản, bảng, ô nhập liệu, hình ảnh theo ý muốn.",
      color: "#2196f3",
      bg: "#eff6ff",
      border: "#bfdbfe",
      btnLabel: "Bắt đầu soạn thảo →",
      features: ["📝 Soạn thảo trực quan", "🖼️ Chèn ảnh", "➕ Thêm ô nhập liệu", "🎨 Định dạng tự do"],
    },
    {
      key: "upload",
      icon: "📁",
      title: "Tải file lên",
      desc: "Upload file Word (.docx, .doc) hoặc PDF có sẵn. Hệ thống sẽ tự động nhận dạng và chuyển đổi thành biểu mẫu.",
      color: "#f97316",
      bg: "#fff7ed",
      border: "#fed7aa",
      btnLabel: "Chọn file tải lên →",
      features: ["📄 Hỗ trợ Word & PDF", "⚡ Tự động chuyển đổi", "✏️ Chỉnh sửa sau khi upload", "🔄 Thay thế nội dung dễ dàng"],
    },
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 64px)",background:"linear-gradient(135deg,#f8fafb 0%,#e8f4f8 100%)",padding:"40px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom:48,textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>📋</div>
        <h2 style={{ margin:0,fontSize:28,fontWeight:800,color:"#12323a" }}>Tạo biểu mẫu mới</h2>
        <p style={{ margin:"10px 0 0",fontSize:15,color:"#6b7280",maxWidth:460 }}>
          Chọn phương thức phù hợp để bắt đầu tạo biểu mẫu của bạn
        </p>
      </div>

      {/* Cards */}
      <div style={{ display:"flex",gap:28,flexWrap:"wrap",justifyContent:"center",maxWidth:820 }}>
        {cards.map((card) => (
          <div
            key={card.key}
            onMouseEnter={() => setHovered(card.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: 360,
              background: "#fff",
              border: `2px solid ${hovered === card.key ? card.color : "#e5e7eb"}`,
              borderRadius: 20,
              padding: "32px 28px",
              cursor: "pointer",
              transition: "all 0.25s",
              boxShadow: hovered === card.key
                ? `0 16px 48px rgba(0,0,0,0.12), 0 0 0 4px ${card.color}22`
                : "0 2px 16px rgba(0,0,0,0.06)",
              transform: hovered === card.key ? "translateY(-6px)" : "none",
            }}
            onClick={() => onChoose(card.key)}
          >
            {/* Icon */}
            <div style={{ width:64,height:64,borderRadius:16,background:card.bg,border:`2px solid ${card.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:20 }}>
              {card.icon}
            </div>

            {/* Title */}
            <div style={{ fontWeight:800,fontSize:20,color:"#12323a",marginBottom:10 }}>{card.title}</div>

            {/* Desc */}
            <div style={{ fontSize:14,color:"#6b7280",lineHeight:1.7,marginBottom:20 }}>{card.desc}</div>

            {/* Features */}
            <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:28 }}>
              {card.features.map((f) => (
                <div key={f} style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#374151" }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:card.color,flexShrink:0 }} />
                  {f}
                </div>
              ))}
            </div>

            {/* Button */}
            <div style={{
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              width:"100%",padding:"12px 0",
              background:`linear-gradient(135deg,${card.color},${card.color}bb)`,
              color:"#fff",borderRadius:12,fontWeight:700,fontSize:15,
              boxShadow:`0 4px 16px ${card.color}44`,
              transition:"all 0.2s",
              transform: hovered === card.key ? "scale(1.02)" : "scale(1)",
            }}>
              {card.btnLabel}
            </div>
          </div>
        ))}
      </div>

      {/* Back */}
      <button onClick={() => navigate("/admin")} style={{ marginTop:36,padding:"10px 24px",background:"transparent",color:"#6b7280",border:"1px solid #d1d5db",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:14 }}>
        ← Quay lại trang quản trị
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function FormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ★ mode: null = chọn phương thức, "create" = tự tạo, "upload" = upload file
  const [mode,             setMode]             = useState(null);
  const [title,            setTitle]            = useState("");
  const [description,      setDescription]      = useState("");
  const [categoryId,       setCategoryId]       = useState("");
  const [categories,       setCategories]       = useState([]);
  const [saving,           setSaving]           = useState(false);
  const [isPDFModalOpen,   setIsPDFModalOpen]   = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [uploadLoading,    setUploadLoading]    = useState(false);
  const [uploadedFormId,   setUploadedFormId]   = useState(null);
  const [uploadedHtml,     setUploadedHtml]     = useState("");
  const [uploadedTitle,    setUploadedTitle]    = useState("");
  const [ruler,            setRuler]            = useState({ left:0, first:0, right:0 });

  const editorRef       = useRef(null);
  const savedRangeRef   = useRef(null);
  const currentBlockRef = useRef(null);
  const scrollRef       = useRef(null);

  useFieldOverlay(editorRef);
  useImageResize(editorRef);

  useEffect(() => { api.get("/forms/categories/list").then((r) => setCategories(r.data||[])); }, []);

  // Khi chọn upload → mở modal ngay
  useEffect(() => {
    if (mode === "upload") setIsPDFModalOpen(true);
  }, [mode]);

  const getEditableBlockFromSelection = useCallback(() => {
    const sel=window.getSelection(); if (!sel||!sel.rangeCount) return null;
    let node=sel.anchorNode; if (!node) return null;
    if (node.nodeType===Node.TEXT_NODE) node=node.parentElement;
    const block=node?.closest("p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th");
    return (block&&editorRef.current?.contains(block)) ? block : null;
  }, []);

  const syncRulerFromSelection = useCallback(() => {
    const block=getEditableBlockFromSelection(); if (!block) return;
    currentBlockRef.current=block;
    setRuler({
      left:  parseInt(block.style.marginLeft  ||"0",10)||0,
      first: parseInt(block.style.textIndent  ||"0",10)||0,
      right: parseInt(block.style.marginRight ||"0",10)||0,
    });
  }, [getEditableBlockFromSelection]);

  // Load form khi edit
  const loadForm = useCallback((node) => {
    if (!node||!id) return;
    editorRef.current=node;
    api.get(`/forms/${id}`).then((r) => {
      node.innerHTML=convertToEditable(r.data.template_html||"");
      setTitle(r.data.title||""); setDescription(r.data.description||""); setCategoryId(r.data.category_id||"");
    });
  }, [id]);

  // Set ref cho editor khi tạo mới
  const setEditorRef = useCallback((node) => {
    if (!node) return;
    editorRef.current = node;
    if (!id) node.innerHTML = "<p></p>";
  }, [id]);

  const saveSelection = useCallback(() => {
    const sel=window.getSelection();
    if (sel&&sel.rangeCount>0&&editorRef.current) {
      const range=sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current=range.cloneRange();
        syncRulerFromSelection();
      }
    }
  }, [syncRulerFromSelection]);

  const applyRulerToCurrentBlock = useCallback((next) => {
    const block=currentBlockRef.current||getEditableBlockFromSelection();
    if (!block) return;
    block.style.marginLeft  =`${next.left}px`;
    block.style.textIndent  =`${next.first}px`;
    block.style.marginRight =`${next.right}px`;
    setRuler(next);
  }, [getEditableBlockFromSelection]);

  const handleInsertField = useCallback((type) => {
    insertFieldAtCursor(type, savedRangeRef.current);
    if (editorRef.current) editorRef.current.focus();
  }, []);

  const handleInsertImage = useCallback(({ src, width, height, align }) => {
    const editor=editorRef.current; if (!editor) return;
    const wStyle=width  ? `width:${width}px;`  : "width:200px;";
    const hStyle=height ? `height:${height}px;` : "";
    const imgTag=`<img src="${src}" style="${wStyle}${hStyle}max-width:100%;display:block;" alt="ảnh" />`;
    const wrapAlign=(align&&align!=="none") ? `style="text-align:${align}"` : "";
    const html=`<p ${wrapAlign}>${imgTag}</p>`;
    editor.focus();
    const sel=window.getSelection();
    if (savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
    document.execCommand("insertHTML", false, html);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tiêu đề!"); return; }
    setSaving(true);
    try {
      const user=JSON.parse(localStorage.getItem("user")||"null");
      const inner=convertBackToForm(editorRef.current);
      const fullHtml=`<div class="word-document" style="font-family:'Times New Roman',Times,serif;font-size:14pt;line-height:2;color:#000;width:100%;box-sizing:border-box;background:#fff;">${inner}</div>`;
      const payload={ title:title.trim(), description:description.trim(), category_id:categoryId||null, template_html:fullHtml, created_by:user?.user_id||1, fields:[] };
      if (id) {
        await api.put(`/forms/${id}`, payload);
      } else {
        await api.post("/forms", payload);
      }
      alert("Lưu thành công!"); navigate("/admin");
    } catch { alert("Lỗi khi lưu biểu mẫu."); }
    finally { setSaving(false); }
  };

  const handleReplaceFile = async (newFormId) => {
    setUploadLoading(true);
    try {
      const res=await api.get(`/forms/${newFormId}`);
      if (editorRef.current) editorRef.current.innerHTML=convertToEditable(res.data.template_html||"");
      await api.delete(`/forms/${newFormId}`);
    } catch { alert("Lỗi khi tải nội dung mới."); }
    finally { setUploadLoading(false); }
  };

  const handleUploadSuccess = async (formId) => {
    setUploadLoading(true);
    try {
      const res=await api.get(`/forms/${formId}`);
      setUploadedFormId(formId); setUploadedHtml(res.data.template_html||""); setUploadedTitle(res.data.title||"");
    } catch { alert("Không thể tải xem trước."); navigate("/admin"); }
    finally { setUploadLoading(false); }
  };

  const handleConfirmUpload = () => navigate("/admin");
  const handleCancelUpload  = async () => {
    if (!window.confirm("Hủy và xóa biểu mẫu này?")) return;
    try { await api.delete(`/forms/${uploadedFormId}`); } catch {}
    setUploadedFormId(null); setUploadedHtml("");
    setMode(null); // Quay về màn hình chọn
  };

  // ════ LOADING ════
  if (uploadLoading) return (
    <div style={{ display:"flex",justifyContent:"center",alignItems:"center",height:"calc(100vh - 64px)" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:44,marginBottom:14 }}>⏳</div><p style={{ color:"#43bfc9",fontWeight:700,fontSize:18 }}>Đang xử lý...</p></div>
    </div>
  );

  // ════ PREVIEW SAU UPLOAD ════
  if (!id && uploadedFormId) return (
    <div style={{ fontFamily:"Segoe UI",background:"#f0f4f8",minHeight:"calc(100vh - 64px)" }}>
      <div style={TS.previewBar}>
        <div>
          <div style={{ fontWeight:800,fontSize:16,color:"#12323a" }}>👁️ Xem trước: <span style={{ color:"#43bfc9" }}>{uploadedTitle}</span></div>
          <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>Kiểm tra nội dung trước khi lưu chính thức.</div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={handleCancelUpload} style={TS.btnDanger}>🗑️ Hủy & Xóa</button>
          <button onClick={handleConfirmUpload} style={TS.btnPrimary}>✅ Xác nhận lưu</button>
        </div>
      </div>
      <div style={{ display:"flex",justifyContent:"center",padding:"28px 24px 60px" }}>
        <div className="word-document" style={TS.previewDoc} dangerouslySetInnerHTML={{ __html:uploadedHtml }} />
      </div>
    </div>
  );

  // ════ CHỌN MODE (chỉ khi tạo mới) ════
  if (!id && !mode) {
    return (
      <>
        <ChooseModeScreen onChoose={(m) => setMode(m)} />
        <PDFUploadModal
          isOpen={isPDFModalOpen}
          onClose={() => { setIsPDFModalOpen(false); setMode(null); }}
          onSuccess={handleUploadSuccess}
        />
      </>
    );
  }

  // ════ EDITOR MODE (tạo mới hoặc edit) ════
  const isEditMode = !!id;
  const pageTitle  = isEditMode ? "✏️ Chỉnh sửa biểu mẫu" : "✏️ Tạo biểu mẫu mới";

  return (
    <div style={{ fontFamily:"Segoe UI",background:"#f0f2f5",height:"calc(100vh - 64px)",display:"flex",flexDirection:"column",overflow:"hidden" }}>

      {/* Top bar */}
      <div style={TS.topBar}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={() => isEditMode ? navigate("/admin") : setMode(null)} style={TS.btnBack}>
            ← {isEditMode ? "Quay lại" : "Chọn lại"}
          </button>
          <div style={{ fontWeight:700,fontSize:15,color:"#16323a" }}>{pageTitle}</div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          {isEditMode && (
            <button onClick={()=>setIsPDFModalOpen(true)} style={TS.btnUpload}>🔄 Thay nội dung bằng file mới</button>
          )}
          <button onClick={handleSave} disabled={saving} style={TS.btnPrimary}>{saving?"⏳ Đang lưu...":"💾 Lưu biểu mẫu"}</button>
        </div>
      </div>

      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        {/* Sidebar */}
        <div style={TS.metaSidebar}>
          <div style={TS.metaCard}>
            <div style={TS.metaTitle}>📋 Thông tin</div>
            <label style={TS.lbl}>Tiêu đề <span style={{ color:"#ef4444" }}>*</span></label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} style={TS.inp} placeholder="Tiêu đề biểu mẫu..." />
            <label style={TS.lbl}>Mô tả</label>
            <input value={description} onChange={(e)=>setDescription(e.target.value)} style={TS.inp} placeholder="Mô tả ngắn..." />
            <label style={TS.lbl}>Danh mục</label>
            <select value={categoryId} onChange={(e)=>setCategoryId(e.target.value)} style={TS.inp}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map((c)=><option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </div>
          <div style={TS.hintCard}>
            <div style={{ fontWeight:700,marginBottom:8,fontSize:13,color:"#92400e" }}>💡 Hướng dẫn</div>
            <div style={{ fontSize:12,color:"#78350f",lineHeight:1.9 }}>
              <div>📝 <strong>Sửa văn bản:</strong> Bấm trực tiếp</div>
              <div>🖼️ <strong>Chèn ảnh:</strong> Click vị trí → <strong style={{ color:"#7c3aed" }}>🖼️ Chèn ảnh</strong></div>
              <div>↔️ <strong>Resize ảnh:</strong> Click ảnh → kéo 8 handle</div>
              <div>⇧ <strong>Giữ Shift:</strong> Kéo handle giữ tỷ lệ</div>
              <div>➕ <strong>Thêm ô nhập:</strong> <strong style={{ color:"#3b82f6" }}>Ô chữ</strong> / <strong style={{ color:"#f97316" }}>Ô số</strong></div>
              <div>🗑️ <strong>Xóa ô:</strong> Hover vào ô → nhấn ✕</div>
              <div>↩ <strong>Hoàn tác:</strong> Ctrl + Z</div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ ...TS.btnPrimary,width:"100%",padding:12,marginTop:12 }}>
            {saving?"⏳ Đang lưu...":"💾 Lưu biểu mẫu"}
          </button>
        </div>

        {/* Editor column */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,position:"relative" }}>
          <SimpleToolbar
            onInsertField={handleInsertField}
            onOpenImageModal={()=>{ saveSelection(); setIsImageModalOpen(true); }}
          />
          <WordRuler value={ruler} onChange={applyRulerToCurrentBlock} />

          <div ref={scrollRef} style={{ flex:1,overflowY:"auto",background:"#e8eaed",padding:"32px 0 80px",position:"relative" }}>
            <style>{`
              .ep table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:4px}
              .ep td,.ep th{padding:2px 4px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;white-space:normal}
              .ep table:not(.two-col-row) td,.ep table:not(.two-col-row) th{border:1px solid #ccc}
              .ep table.two-col-row{border:none!important;margin:2px 0!important}
              .ep table.two-col-row td{border:none!important;padding:1px 0!important;vertical-align:top;background:transparent!important}
              .ep table.two-col-row td.col-left{width:45%;text-align:left}
              .ep table.two-col-row td.col-right{width:55%;text-align:center}
              .ep p{margin:4px 0;line-height:2}
              .ep h1,.ep h2,.ep h3{text-align:center;margin:10px 0;font-weight:bold}
              .ep .doc-center{text-align:center!important}
              .ep [data-editable-field]{border:none!important;border-bottom:2px dashed #93c5fd!important;background:rgba(219,234,254,0.4)!important;border-radius:2px;outline:none;cursor:text;min-width:60px;display:inline-block;vertical-align:baseline;padding:0 2px;transition:background 0.15s,border-color 0.15s;}
              .ep [data-editable-field]:hover{background:rgba(219,234,254,0.75)!important;border-bottom-color:#3b82f6!important;}
              .ep [data-editable-field]:focus{background:rgba(219,234,254,0.9)!important;border-bottom-color:#1d4ed8!important;box-shadow:0 2px 0 rgba(59,130,246,0.25);}
              .ep [data-field-type="number"]{border-bottom-color:#fdba74!important;background:rgba(255,237,213,0.4)!important;text-align:center;}
              .ep [data-field-type="number"]:focus{border-bottom-color:#ea580c!important;box-shadow:0 2px 0 rgba(249,115,22,0.25);}
              .ep img{cursor:pointer;transition:outline 0.12s;border-radius:2px;max-width:100%;}
              .ep img:hover{outline:2px solid #a78bfa;box-shadow:0 0 0 3px rgba(167,139,250,0.15);}
              .ep img.img-selected{outline:2px solid #7c3aed!important;box-shadow:0 0 0 4px rgba(124,58,237,0.2)!important;}
              [data-img-overlay] [data-img-handle]:hover{background:#7c3aed!important;}
            `}</style>
            <div style={{ display:"flex",justifyContent:"center",padding:"0 16px" }}>
              <div
                ref={isEditMode ? loadForm : setEditorRef}
                className="ep"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onKeyUp={saveSelection} onMouseUp={saveSelection} onSelect={saveSelection} onFocus={saveSelection}
                style={{ width:"240mm",minHeight:"297mm",padding:"20mm 28mm",background:"#fff",boxShadow:"0 4px 32px rgba(0,0,0,0.15)",boxSizing:"border-box",fontFamily:"'Times New Roman',Times,serif",fontSize:"14pt",lineHeight:2,color:"#000",outline:"none" }}
              />
            </div>
          </div>
        </div>
      </div>

      <PDFUploadModal
        isOpen={isPDFModalOpen}
        onClose={() => { setIsPDFModalOpen(false); if (!isEditMode) setMode(null); }}
        onSuccess={isEditMode ? handleReplaceFile : handleUploadSuccess}
      />
      <ImageModal isOpen={isImageModalOpen} onClose={()=>setIsImageModalOpen(false)} onInsert={handleInsertImage} />
    </div>
  );
}

const TS = {
  topBar:{ height:56,background:"#fff",borderBottom:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 20px",gap:12,flexWrap:"wrap",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",flexShrink:0,zIndex:200 },
  metaSidebar:{ width:240,flexShrink:0,background:"#f8fafb",borderRight:"1px solid #e5e7eb",padding:"16px 14px",overflowY:"auto" },
  metaCard:{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:14,marginBottom:12 },
  metaTitle:{ fontWeight:700,fontSize:13,color:"#374151",marginBottom:12 },
  hintCard:{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"12px 14px",marginBottom:4 },
  lbl:{ display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4,marginTop:10 },
  inp:{ width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid #d1d5db",fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff" },
  previewBar:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,padding:"16px 24px",background:"#fff",borderBottom:"1px solid #d1fae5",boxShadow:"0 2px 8px rgba(67,191,201,0.08)",position:"sticky",top:0,zIndex:100 },
  previewDoc:{ width:"210mm",minHeight:"297mm",padding:"20mm 25mm",background:"#fff",boxShadow:"0 4px 24px rgba(0,0,0,0.1)",fontFamily:"'Times New Roman',serif",fontSize:"14pt",lineHeight:2,boxSizing:"border-box",borderRadius:4 },
  btnBack:{ padding:"8px 14px",background:"#eceff1",color:"#546e7a",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13 },
  btnPrimary:{ padding:"9px 18px",background:"linear-gradient(135deg,#43bfc9,#2196f3)",color:"#fff",border:"none",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,boxShadow:"0 4px 14px rgba(67,191,201,0.3)" },
  btnUpload:{ padding:"9px 16px",background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:13,boxShadow:"0 4px 14px rgba(239,68,68,0.25)" },
  btnDanger:{ padding:"9px 16px",background:"#fee2e2",color:"#ef4444",border:"1px solid #fca5a5",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:13 },
};