const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

// ================= HELPERS =================

function getSofficePath() {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  // Linux
  if (process.platform === "linux") {
    const linuxPaths = [
      "/usr/bin/soffice",
      "/usr/bin/libreoffice",
      "/usr/local/bin/soffice",
      "/opt/libreoffice/program/soffice",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return "soffice"; // fallback: dùng PATH
  }
  // macOS
  if (process.platform === "darwin") {
    return "/Applications/LibreOffice.app/Contents/MacOS/soffice";
  }
  // Windows
  return "C:\\Program Files\\LibreOffice\\program\\soffice.exe";
}

// ── Nhận diện dòng chức danh người ký (cột phải của khối chữ ký) ──
// Bắt: "QUYỀN HẠN...", "THỦ TRƯỞNG...", "GIÁM ĐỐC", "CHỦ TỊCH",
//       "HIỆU TRƯỞNG", "TỔNG GIÁM ĐỐC", "KT. GIÁM ĐỐC", v.v.
// Strategy: ALL CAPS + không phải mục lục (I., II., 1., 2.) + độ dài hợp lý
function isChucDanhKy(str) {
  const tr = str.trim();
  if (!tr) return false;
  // Loại trừ mục lục
  if (/^[IVX]+\s*[.)]/.test(tr)) return false;
  if (/^\d+[.)]\s/.test(tr)) return false;
  // Loại trừ dòng quá dài (nội dung thường)
  if (tr.length > 80) return false;
  // Loại trừ dòng chỉ có dấu
  if (/^[-─—.·,;]{3,}$/.test(tr)) return false;
  // Loại trừ "(Ký tên...)" — dòng hướng dẫn, không phải chức danh
  if (/^\(/.test(tr)) return false;
  // Phải là ALL CAPS tiếng Việt
  return (
    tr.length > 2 &&
    tr === tr.toLocaleUpperCase("vi-VN") &&
    /[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]/i.test(tr)
  );
}

// ── Convert DOCX → HTML dùng mammoth ──
async function convertDocxToHtml(filePath) {
  console.log(`  [mammoth] bắt đầu convert: ${filePath}`);
  const result = await mammoth.convertToHtml(
    { path: filePath },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.doc-title:fresh",
        "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
        "b => b", "i => i", "u => u", "strike => s",
        "p[style-name='Normal'] => p:fresh",
        "table => table", "tr => tr", "td => td",
      ],
      convertImage: mammoth.images.inline((image) =>
        image.read("base64").then((buf) => ({
          src: `data:${image.contentType};base64,${buf}`,
        }))
      ),
      includeDefaultStyleMap: true,
    }
  );
  console.log(`  [mammoth] convert xong, HTML length: ${result.value.length}`);

  let html = result.value;

  // ── Fix 1: CENTER các tiêu đề ALL CAPS trong <p><b>...</b></p> ──
  html = html.replace(
    /<p>(<b>|<strong>)([^<]{2,80})(<\/b>|<\/strong>)<\/p>/g,
    (match, open, text, close) => {
      const tr = text.trim();
      if (tr.length > 2 && tr === tr.toLocaleUpperCase("vi-VN") &&
          !/^[IVX]+\s*[.)]/.test(tr) && !/^\d+[.)]\s/.test(tr)) {
        return `<p class="doc-center">${open}${text}${close}</p>`;
      }
      return match;
    }
  );

  // ── Fix 2: Đánh class two-col-row cho các <table> của mammoth ──
  // Mammoth đã tạo đúng layout 2 cột — chỉ cần thêm class để CSS đúng
  html = html.replace(/<table>/g, '<table class="two-col-row">');
  html = html.replace(/<tr>/g, '<tr>');
  html = html.replace(/<td>/g, '<td class="col-left">');

  // Fix td: td đầu tiên = col-left, td thứ hai = col-right
  html = html.replace(
    /(<tr>)\s*(<td class="col-left">)([\s\S]*?)(<\/td>)\s*(<td class="col-left">)/g,
    (match, tr, td1, content, closetd, td2) =>
      `${tr}${td1}${content}${closetd}<td class="col-right">`
  );

  console.log(`  [docx] post-process xong`);
  return html;
}


// ── Convert .doc → .docx bằng LibreOffice ──
function convertDocToDocx(docPath) {
  return new Promise((resolve, reject) => {
    const soffice = getSofficePath();

    // Kiểm tra soffice tồn tại (chỉ với đường dẫn tuyệt đối)
    if (soffice !== "soffice" && !fs.existsSync(soffice)) {
      return reject(new Error(
        `Không tìm thấy LibreOffice tại: ${soffice}. ` +
        `Hãy cài LibreOffice hoặc set biến môi trường LIBREOFFICE_PATH.`
      ));
    }

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lo-docx-"));

    execFile(
      soffice,
      [
        "--headless",
        "--norestore",
        "--nofirststartwizard",
        "--convert-to", "docx",
        "--outdir", outDir,
        docPath,
      ],
      {
        timeout: 60000,
        env: { ...process.env, DISPLAY: "", HOME: os.tmpdir() },
      },
      (err) => {
        if (err) {
          // Dọn thư mục tạm
          try { fs.rmSync(outDir, { recursive: true }); } catch {}
          return reject(new Error(
            `LibreOffice lỗi khi convert .doc: ${err.message}. ` +
            `Thử upload file .docx thay vì .doc để nhanh hơn.`
          ));
        }
        const files = fs.readdirSync(outDir);
        const docxFile = files.find((f) => /\.docx$/i.test(f));
        if (!docxFile) {
          try { fs.rmSync(outDir, { recursive: true }); } catch {}
          return reject(new Error("LibreOffice không tạo được file .docx output."));
        }
        resolve(path.join(outDir, docxFile));
      }
    );
  });
}

// ══════════════════════════════════════════════════════
// ── Convert PDF → HTML ──
// ══════════════════════════════════════════════════════
async function convertPdfToHtml(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  const rawLines = pdfData.text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // ── Pre-process 1: merge "NAM"/"VIỆT NAM" vào dòng CỘNG HÒA ──
  const mergedRaw = [];
  for (let idx = 0; idx < rawLines.length; idx++) {
    const cur = rawLines[idx].trim();
    const prev = mergedRaw[mergedRaw.length - 1] || "";
    const prev2 = mergedRaw[mergedRaw.length - 2] || "";

    if (/^(VIỆT\s*)?NAM$/i.test(cur) && /CỘNG\s*H[OÒ]A/i.test(prev)) {
      mergedRaw[mergedRaw.length - 1] = prev + " " + cur;
      continue;
    }
    if (
      /^(VIỆT\s*)?NAM$/i.test(cur) &&
      /^[-─—]{3,}$/.test(prev) &&
      /CỘNG\s*H[OÒ]A/i.test(prev2)
    ) {
      mergedRaw[mergedRaw.length - 2] = prev2 + " " + cur;
      continue;
    }
    if (
      /^(VIỆT\s*)?NAM$/i.test(cur) &&
      mergedRaw.some(l => /CỘNG\s*H[OÒ]A/i.test(l))
    ) {
      for (let k = mergedRaw.length - 1; k >= 0; k--) {
        if (/CỘNG\s*H[OÒ]A/i.test(mergedRaw[k])) {
          mergedRaw[k] = mergedRaw[k] + " " + cur;
          break;
        }
      }
      continue;
    }
    mergedRaw.push(cur);
  }

  // ── Pre-process 2: xử lý khối chữ ký ──
  //
  // pdf-parse trả text theo column order (trái trước, phải sau):
  //   "Nơi nhận:"      ← cột trái, xuất hiện TRƯỚC
  //   "- ...;"
  //   "- ...;"
  //   "THỦ TRƯỞNG..."  ← cột phải, xuất hiện SAU (ALL CAPS = chức danh)
  //   "(Ký tên...)"
  //
  // Strategy: khi gặp "Nơi nhận", thu thập các dòng "-" kế tiếp.
  // Dòng ALL CAPS đầu tiên xuất hiện sau = chức danh người ký.
  // Không hardcode tên chức danh — detect theo vị trí + ALL CAPS.

  const processedLines = [];
  let pendingNoiNhan = null; // { noiNhanText, dashLines[] }

  for (let idx = 0; idx < mergedRaw.length; idx++) {
    const line = mergedRaw[idx];
    const isNoiNhan     = /^N[ơo][iì]\s*nh[ậa]n/i.test(line);
    const isNoiNhanItem = /^-\s/.test(line); // dòng "- ...;" thuộc Nơi nhận
    const isKyTen       = /^\(.*[Kk][yý]\s*t[eê]n/.test(line); // "(Ký tên...)"

    if (isNoiNhan) {
      pendingNoiNhan = { noiNhanText: line, dashLines: [] };
      continue;
    }

    if (pendingNoiNhan) {
      if (isNoiNhanItem) {
        // Dòng gạch đầu dòng → thuộc Nơi nhận
        pendingNoiNhan.dashLines.push(line);
        continue;
      }

      if (isChucDanhKy(line)) {
        // Tìm thấy chức danh → thu thêm dòng "(Ký tên...)" nếu có
        let kyTenLines = [];
        let j = idx + 1;
        while (j < mergedRaw.length && /^\(/.test(mergedRaw[j])) {
          kyTenLines.push(mergedRaw[j]);
          j++;
        }
        processedLines.push({
          type: "signature_block",
          noiNhanText: pendingNoiNhan.noiNhanText,
          dashLines:   pendingNoiNhan.dashLines,
          chucDanh:    line,
          kyTenLines,
        });
        pendingNoiNhan = null;
        idx = j - 1; // skip các dòng "(Ký tên...)" đã lấy
        continue;
      }

      // Dòng không liên quan → flush pendingNoiNhan thành text thường
      processedLines.push({ type: "text", text: pendingNoiNhan.noiNhanText });
      pendingNoiNhan.dashLines.forEach(d => processedLines.push({ type: "text", text: d }));
      pendingNoiNhan = null;
      // tiếp tục xử lý dòng hiện tại (không continue)
    }

    // Chức danh đứng một mình (không có Nơi nhận trước)
    if (isChucDanhKy(line) && !pendingNoiNhan) {
      // Kiểm tra xem đây có phải chức danh chữ ký không (phải có dòng ký tên kế tiếp)
      const nextLine = mergedRaw[idx + 1] || "";
      if (/^\(.*[Kk][yý]\s*t[eê]n/.test(nextLine) || /^\(.*[Kk]ý/.test(nextLine)) {
        let kyTenLines = [];
        let j = idx + 1;
        while (j < mergedRaw.length && /^\(/.test(mergedRaw[j])) {
          kyTenLines.push(mergedRaw[j]);
          j++;
        }
        processedLines.push({
          type: "signature_block",
          noiNhanText: "",
          dashLines:   [],
          chucDanh:    line,
          kyTenLines,
        });
        idx = j - 1;
        continue;
      }
    }

    processedLines.push({ type: "text", text: line });
  }

  // Flush nếu còn pending
  if (pendingNoiNhan) {
    processedLines.push({ type: "text", text: pendingNoiNhan.noiNhanText });
    pendingNoiNhan.dashLines.forEach(d => processedLines.push({ type: "text", text: d }));
  }

  // Tách phần Ghi chú
  let mainLines = processedLines;
  let ghiChuLines = [];
  const ghiChuIdx = processedLines.findIndex(
    l => l.type === "text" && /^[Gg]hi\s*[Cc]h[úu]\s*:/i.test(l.text)
  );
  if (ghiChuIdx !== -1) {
    mainLines = processedLines.slice(0, ghiChuIdx);
    ghiChuLines = processedLines.slice(ghiChuIdx).map(l => l.text || "");
  }

  let html = "";
  let i = 0;

  while (i < mainLines.length) {
    const item = mainLines[i];

    // ── Render khối chữ ký ──
    // Layout chuẩn văn bản hành chính VN:
    //   Cột trái  (45%): Nơi nhận (bold italic) + danh sách "-"
    //   Cột phải (55%): Chức danh (bold, căn giữa) + (Ký tên...) (italic, căn giữa)
    if (item.type === "signature_block") {
      const chucDanhEsc = escHtml(item.chucDanh);
      const kyTenHtml = item.kyTenLines.map(l => `<i>${escHtml(l)}</i>`).join("<br/>");

      let leftContent = "";
      if (item.noiNhanText) {
        leftContent += `<strong><i>${escHtml(item.noiNhanText)}</i></strong>`;
        item.dashLines.forEach(d => {
          leftContent += `<br/>${escHtml(d)}`;
        });
      }

      const rightContent = item.chucDanh
        ? `<strong>${chucDanhEsc}</strong>${kyTenHtml ? "<br/>" + kyTenHtml : ""}`
        : kyTenHtml;

      html += `<table class="two-col-row signature-row"><tr>
        <td class="col-left">${leftContent}</td>
        <td class="col-right">${rightContent}</td>
      </tr></table>\n`;
      i++;
      continue;
    }

    const line = item.text;
    const next = mainLines[i + 1]?.text || "";

    const escLine = escHtml(line);
    const isCongHoa     = /CỘNG\s*H[OÒ]A/i.test(line);
    const isDocLap      = /[Đđ]ộc\s*lập.*[Tt]ự\s*do|[Hh]ạnh\s*phúc/i.test(line);
    const isDivider     = /^[-─—]{3,}$/.test(line);
    const nextIsCongHoa = /CỘNG\s*H[OÒ]A/i.test(next);

    // ── Dòng "Số: ..." + "ngày...tháng...năm..." bị pdf-parse gộp 1 dòng ──
    // Thực tế trong PDF chúng nằm 2 cột: Số (trái) | ngày tháng năm (phải)
    // Tách tại điểm ", ngày" hoặc khoảng trắng + "ngày"
    const soNgayMatch = line.match(
      /^(S[ốo]\s*:.*?)\s{2,}([,，]?\s*ng[àa]y\s*.+)$/i
    ) || line.match(
      /^(S[ốo]\s*:.*?)[,，]\s*(ng[àa]y\s*.+)$/i
    );
    if (soNgayMatch) {
      // Trim trailing whitespace/dots từ leftPart
      const leftPart  = soNgayMatch[1].trimEnd();
      const rightPart = soNgayMatch[2].replace(/^[,，\s]+/, "").trim();
      html += `<table class="two-col-row"><tr>
        <td class="col-left">${escHtml(leftPart)}</td>
        <td class="col-right" style="text-align:right;">${escHtml(rightPart)}</td>
      </tr></table>\n`;
      i++;
      continue;
    }


    const isAllCapsTitle = (() => {
      const tr = line.trim();
      if (/^[IVX]+\s*[.)]/i.test(tr)) return false;
      if (/^\d+[.)]\s/.test(tr)) return false;
      if (tr.length > 80) return false;
      return (
        tr.length > 2 &&
        tr === tr.toLocaleUpperCase("vi-VN") &&
        !/^[-─—.·]{3,}$/.test(tr) &&
        /[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ]/.test(tr)
      );
    })();

    const isItalicLine = /^[Cc]ăn\s*cứ|^[Tt]heo\s*đề\s*nghị/i.test(line);

    if (nextIsCongHoa) {
      html += `<table class="two-col-row"><tr>
        <td class="col-left">${escLine}</td>
        <td class="col-right"><strong>${escHtml(next)}</strong></td>
      </tr></table>\n`;
      i += 2;
      continue;
    }

    if (isCongHoa) {
      html += `<table class="two-col-row"><tr>
        <td class="col-left"></td>
        <td class="col-right"><strong>${escLine}</strong></td>
      </tr></table>\n`;
      i++;
      continue;
    }

    if (isDocLap) {
      html += `<table class="two-col-row"><tr>
        <td class="col-left"></td>
        <td class="col-right"><i>${escLine}</i></td>
      </tr></table>\n`;
      i++;
      continue;
    }

    if (isDivider) {
      html += `<table class="two-col-row"><tr>
        <td class="col-left"></td>
        <td class="col-right">${escLine}</td>
      </tr></table>\n`;
      i++;
      continue;
    }

    if (isAllCapsTitle) {
      html += `<p class="doc-center"><strong>${escLine}</strong></p>\n`;
      i++;
      continue;
    }

    if (isItalicLine) {
      let combined = line;
      let j = i + 1;
      while (j < mainLines.length) {
        const cont = mainLines[j]?.text || "";
        if (
          /^[Cc]ăn\s*cứ|^[Tt]heo\s*đề\s*nghị|^[Qq]uyết\s*định|^[Đđ]iều/i.test(cont) ||
          /CỘNG\s*H[OÒ]A/i.test(cont) ||
          /^[-─—]{3,}$/.test(cont) ||
          (cont === cont.toLocaleUpperCase("vi-VN") && cont.length < 60 && /[A-ZÀÁÂ]/.test(cont))
        ) break;
        combined += " " + cont;
        j++;
      }
      html += `<p><i>${escHtml(combined)}</i></p>\n`;
      i = j;
      continue;
    }

    html += `<p>${escLine}</p>\n`;
    i++;
  }

  if (ghiChuLines.length) {
    html += `<div style="margin-top:20px;color:#444;font-style:italic;border-top:1px solid #eee;padding-top:10px;">`;
    ghiChuLines.forEach(l => { html += `<p>${escHtml(l)}</p>\n`; });
    html += `</div>`;
  }

  return html;
}

function escHtml(t) {
  return (t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Helper tạo textarea ──
function makeTextarea(name, minWidth = 120) {
  return `<textarea name="${name}" rows="1"
    oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
    style="border:none;border-bottom:1px dotted #000;min-width:${minWidth}px;width:100%;max-width:100%;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:block;resize:none;overflow:hidden;padding:0;margin:0;line-height:inherit;box-sizing:border-box;"></textarea>`;
}

// ── Helper tạo input date ──
function makeDateInput(name, width = 50) {
  return `<input type="text" name="${name}"
    inputmode="numeric" pattern="[0-9]*" maxlength="4" data-date-field="1"
    style="border:none;border-bottom:1px dotted #000;width:${width}px;min-width:40px;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:inline-block;vertical-align:baseline;text-align:center;" />`;
}

// ── Helper tạo number input — chỉ nhận chữ số ──
function makeNumberInput(name, width = 100) {
  return `<input type="text" name="${name}" inputmode="numeric"
    oninput="this.value=this.value.replace(/[^0-9]/g,'')"
    onkeypress="return /[0-9]/.test(event.key)"
    onpaste="var e=this;setTimeout(function(){e.value=e.value.replace(/[^0-9]/g,'')},0)"
    style="border:none;border-bottom:1px dotted #000;width:${width}px;min-width:60px;font-family:inherit;font-size:inherit;outline:none;background:transparent;display:inline-block;vertical-align:baseline;" />`;
}

// ── Inject input fields ──
function injectInputFields(rawHtml) {
  const fields = [];
  let fieldIndex = 0;

  let mainHtml = rawHtml;
  let ghiChuHtml = "";
  const ghiChuIdx = rawHtml.search(/([Gg]hi\s*[Cc]h[úu]\s*:)/);
  if (ghiChuIdx !== -1) {
    mainHtml = rawHtml.substring(0, ghiChuIdx);
    ghiChuHtml = rawHtml.substring(ghiChuIdx);
  }

  // ── Xử lý "Số: ..." TRƯỚC — chỉ cho nhập số ──
  // Bắt pattern: "Số:" + dots/spaces + phần hậu tố tuỳ chọn "/TTr-..." hoặc "-..."
  // Cũng bắt "Số:" đứng một mình (không có dots) ở cuối dòng hoặc trước thẻ đóng
  mainHtml = mainHtml.replace(
    /S[ốo]\s*:\s*(?:[.…·\s]{1,}(\/[^<\s"]{0,40}|-[^<\s"]{0,40})?|(?=<|$))/gi,
    (match, suffix) => {
      fieldIndex++;
      const n = `so_${fieldIndex}`;
      fields.push({ field_name: n, field_label: "So", field_type: "number", is_required: 0 });
      const suffixHtml = suffix ? `<span>${escHtml(suffix.trim())}</span>` : "";
      return `Số: ${makeNumberInput(n, 100)}${suffixHtml}`;
    }
  );

  mainHtml = mainHtml.replace(/\((\d+)\)/g, (match, no) => {
    const fieldName = `field_no_${no}`;
    if (!fields.find((f) => f.field_name === fieldName)) {
      fields.push({ field_name: fieldName, field_label: `Truong ${no}`, placeholder_no: parseInt(no), field_type: "text", is_required: 1 });
    }
    return makeTextarea(fieldName, 120);
  });

  mainHtml = mainHtml.replace(
    /ng[àa]y\s*[.…·\s]{0,10}\s*th[áa]ng\s*[.…·\s]{0,10}\s*n[ăa]m\s*[.…·\s]{0,10}/gi,
    () => {
      fieldIndex++;
      const dName = `ngay_${fieldIndex}`, mName = `thang_${fieldIndex}`, yName = `nam_${fieldIndex}`;
      fields.push(
        { field_name: dName, field_label: "Ngay", field_type: "text", is_required: 0 },
        { field_name: mName, field_label: "Thang", field_type: "text", is_required: 0 },
        { field_name: yName, field_label: "Nam", field_type: "text", is_required: 0 }
      );
      return `ngày ${makeDateInput(dName, 50)} tháng ${makeDateInput(mName, 50)} năm ${makeDateInput(yName, 70)} `;
    }
  );

  // ── BƯỚC 1: Đánh dấu các <p> chỉ chứa dots → thay bằng placeholder ──
  // Trước khi inject từng loại dots riêng lẻ, gộp toàn bộ nội dung dots
  // trong cùng 1 <p> thành 1 textarea duy nhất.
  // Pattern: <p> chỉ chứa các ký tự dots/ellipsis/spaces → 1 textarea
  mainHtml = mainHtml.replace(
    /<p>([\s…\u2026.·\u00B7]*)<\/p>/g,
    (match, content) => {
      const stripped = content.replace(/[\s…\u2026.·\u00B7]/g, "");
      if (stripped.length > 0) return match; // có nội dung khác → giữ nguyên
      // Toàn bộ <p> chỉ là dots/spaces → thay bằng 1 textarea
      fieldIndex++;
      const n = `dot_${fieldIndex}`;
      fields.push({ field_name: n, field_label: `O dien ${fieldIndex}`, field_type: "text", is_required: 0 });
      return `<p>${makeTextarea(n, 200)}</p>`;
    }
  );

  // ── BƯỚC 2: Gộp các <p><textarea></p> liên tiếp thành 1 ──
  mainHtml = mainHtml.replace(
    /(<p>\s*<textarea[^>]*>\s*<\/textarea>\s*<\/p>\s*){2,}/g,
    (match) => {
      const name = (match.match(/name="([^"]+)"/) || [])[1] || `dot_merged_${fieldIndex++}`;
      return `<p>${makeTextarea(name, 200)}</p>\n`;
    }
  );

  // ── BƯỚC 3: Xử lý dots còn sót trong <p> có nội dung hỗn hợp ──
  mainHtml = mainHtml.replace(/[.]{5,}/g, () => {
    fieldIndex++;
    const n = `dot_${fieldIndex}`;
    fields.push({ field_name: n, field_label: `O dien ${fieldIndex}`, field_type: "text", is_required: 0 });
    return makeTextarea(n, 200);
  });

  mainHtml = mainHtml.replace(/\u2026{2,}/g, () => {
    fieldIndex++;
    const n = `dot_${fieldIndex}`;
    fields.push({ field_name: n, field_label: `O dien ${fieldIndex}`, field_type: "text", is_required: 0 });
    return makeTextarea(n, 200);
  });

  mainHtml = mainHtml.replace(/\u2026/g, () => {
    fieldIndex++;
    const n = `dot_${fieldIndex}`;
    fields.push({ field_name: n, field_label: `O ${fieldIndex}`, field_type: "text", is_required: 0 });
    return makeTextarea(n, 120);
  });

  mainHtml = mainHtml.replace(/[.]{2,4}/g, () => {
    fieldIndex++;
    const n = `dot_${fieldIndex}`;
    fields.push({ field_name: n, field_label: `O ${fieldIndex}`, field_type: "text", is_required: 0 });
    return makeTextarea(n, 80);
  });

  // ── BƯỚC 4: Gộp lần 2 phòng trường hợp còn sót ──
  mainHtml = mainHtml.replace(
    /(<p>\s*<textarea[^>]*>\s*<\/textarea>\s*<\/p>\s*){2,}/g,
    (match) => {
      const name = (match.match(/name="([^"]+)"/) || [])[1] || `dot_merged_${fieldIndex++}`;
      return `<p>${makeTextarea(name, 200)}</p>\n`;
    }
  );

  const html = mainHtml + (ghiChuHtml
    ? `<div style="margin-top:20px;color:#444;font-style:italic;border-top:1px solid #eee;padding-top:10px;">${ghiChuHtml}</div>`
    : "");

  return { html, fields };
}

// ── wrapHtml ──
function wrapHtml(html) {
  return `<div class="word-document" style="font-family:'Times New Roman',Times,serif;font-size:14pt;line-height:2;color:#000;width:100%;box-sizing:border-box;background:#fff;">
  <style>
    .word-document {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt; line-height: 2; color: #000;
      width: 100%; box-sizing: border-box; background: #fff;
    }
    .word-document table {
      width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px;
    }
    .word-document td, .word-document th {
      padding: 2px 4px; vertical-align: top;
      word-wrap: break-word; overflow-wrap: break-word; white-space: normal;
    }
    .word-document table:not(.two-col-row) td:last-child { min-width: 200px; white-space: nowrap; }

    /* ── 2 cột văn bản hành chính ── */
    .word-document table.two-col-row {
      width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; border: none;
    }
    .word-document table.two-col-row td {
      border: none; padding: 1px 0; vertical-align: top;
      word-wrap: break-word; white-space: normal;
    }
    .word-document table.two-col-row td.col-left  { width: 45%; text-align: left; }
    .word-document table.two-col-row td.col-right { width: 55%; text-align: center; word-break: break-word; }

    /* ── Khối chữ ký: cột phải căn GIỮA (chuẩn văn bản hành chính VN) ── */
    .word-document table.signature-row td.col-left  { vertical-align: top; }
    .word-document table.signature-row td.col-right { text-align: center; vertical-align: top; }

    .word-document p { margin: 4px 0; line-height: 2; }
    .word-document p.text-right { text-align: right; }
    .word-document h1, .word-document h2, .word-document h3,
    .word-document .doc-title, .word-document .doc-subtitle {
      font-size: 14pt; font-weight: bold; text-align: center !important; margin: 10px 0;
    }
    .word-document .doc-center { text-align: center !important; width: 100%; }
    .word-document p > strong:only-child,
    .word-document p > b:only-child { display: block; text-align: center; width: 100%; }
    .word-document .page-break { border-top: 1px dashed #ccc; margin: 20px 0; }
    .word-document b, .word-document strong { font-weight: bold; }
    .word-document i, .word-document em { font-style: italic; }
    .word-document u { text-decoration: underline; }
    .word-document textarea {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt; line-height: 2; width: 100%; max-width: 100%;
    }
    .word-document input[type="text"] {
      font-family: 'Times New Roman', Times, serif; font-size: 14pt; max-width: 100%;
    }
    @media print {
      .word-document { font-size: 14pt !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
      .word-document .page-break { display: none; }
    }
  </style>
  ${html}
  </div>`;
}

function insertFields(formId, fields, connection, callback) {
  if (!fields || fields.length === 0) return callback(null);
  const values = fields.map((f, i) => [
    formId, f.field_name || `field_${i+1}`, f.field_label || `Trường ${i+1}`,
    f.field_type || "text", f.is_required ? 1 : 0, f.placeholder_no || null,
    f.x_pos || 0, f.y_pos || 0, f.width_size || 150,
  ]);
  connection.query(
    `INSERT INTO form_fields (form_id,field_name,field_label,field_type,is_required,placeholder_no,x_pos,y_pos,width_size) VALUES ?`,
    [values], callback
  );
}

function saveFormToDB(formData, fields, res) {
  const { title, description, category_id, template_html, created_by } = formData;
  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: "Lỗi transaction: " + err.message });
    connection.query(
      `INSERT INTO forms (title,description,category_id,template_html,created_by) VALUES (?,?,?,?,?)`,
      [title, description, category_id, template_html, created_by],
      (err2, result) => {
        if (err2) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err2.message }); });
        const formId = result.insertId;
        insertFields(formId, fields, connection, (err3) => {
          if (err3) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err3.message }); });
          connection.commit((err4) => {
            connection.release();
            if (err4) return res.status(500).json({ error: err4.message });
            res.json({ message: "Tải lên thành công", form_id: formId, fields_detected: fields.length });
          });
        });
      }
    );
  });
}

// ================= 1. UPLOAD DOCX / DOC / PDF =================
exports.createFormPDF = async (req, res) => {
  const { title, description, category_id, created_by } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Vui lòng tải lên file." });

  const filePath = path.resolve("uploads", file.filename);
  const ext = path.extname(file.originalname).toLowerCase();

  // Timeout toàn bộ request: 90 giây
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Xử lý quá lâu (>90s). Thử lại hoặc dùng file nhỏ hơn." });
    }
  }, 90000);

  const done = () => clearTimeout(timeoutId);

  try {
    console.log(`📂 Bắt đầu xử lý: ${file.originalname} (${ext}), size: ${file.size} bytes`);
    const t0 = Date.now();

    let rawHtml = "";
    if (ext === ".pdf") {
      console.log("📄 PDF: extract text...");
      rawHtml = await convertPdfToHtml(filePath);
      console.log(`✅ PDF xong: ${Date.now() - t0}ms`);
    } else if (ext === ".docx") {
      console.log("📝 DOCX: mammoth...");
      rawHtml = await convertDocxToHtml(filePath);
      console.log(`✅ DOCX xong: ${Date.now() - t0}ms`);
    } else if (ext === ".doc") {
      console.log("📝 DOC: LibreOffice → DOCX...");
      const docxPath = await convertDocToDocx(filePath);
      console.log(`  LibreOffice xong: ${Date.now() - t0}ms`);
      console.log(`  DOCX path: ${docxPath}, exists: ${fs.existsSync(docxPath)}, size: ${fs.statSync(docxPath).size} bytes`);
      rawHtml = await convertDocxToHtml(docxPath);
      console.log(`✅ DOC xong: ${Date.now() - t0}ms`);
      // Dọn file tạm
      try { fs.unlinkSync(docxPath); } catch {}
    } else {
      done();
      return res.status(400).json({ error: "Chỉ hỗ trợ .pdf, .docx, .doc" });
    }

    console.log("🔧 Inject input fields...");
    const { html, fields } = injectInputFields(rawHtml);
    console.log(`  Fields detected: ${fields.length}, HTML size: ${html.length} chars`);

    // Override res.json để clear timeout khi response gửi xong
    const originalJson = res.json.bind(res);
    res.json = (data) => { done(); return originalJson(data); };

    saveFormToDB(
      { title: title || "Biểu mẫu", description: description || "", category_id: category_id || null, template_html: wrapHtml(html), created_by: created_by || null },
      fields, res
    );
  } catch (error) {
    done();
    console.error("❌ Lỗi:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Lỗi hệ thống", detail: error.message });
    }
  }
};

// ================= 2. TẠO BẰNG HTML =================
exports.createForm = (req, res) => {
  const { title, description, category_id, template_html, created_by, fields = [] } = req.body;
  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query(
      `INSERT INTO forms (title,description,category_id,template_html,created_by) VALUES (?,?,?,?,?)`,
      [title||"", description||"", category_id||null, template_html||"", created_by||null],
      (err2, result) => {
        if (err2) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err2.message }); });
        const formId = result.insertId;
        insertFields(formId, fields, connection, (err3) => {
          if (err3) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err3.message }); });
          connection.commit((err4) => {
            connection.release();
            if (err4) return res.status(500).json({ error: err4.message });
            res.json({ message: "Tạo biểu mẫu thành công", form_id: formId });
          });
        });
      }
    );
  });
};

// ================= 3. CẬP NHẬT =================
exports.updateForm = (req, res) => {
  const { id } = req.params;
  const { title, description, category_id, template_html, created_by, fields = [] } = req.body;
  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query(
      `UPDATE forms SET title=?,description=?,category_id=?,template_html=?,created_by=? WHERE form_id=?`,
      [title||"", description||"", category_id||null, template_html||"", created_by||null, id],
      (err2) => {
        if (err2) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err2.message }); });
        connection.query("DELETE FROM form_fields WHERE form_id=?", [id], (err3) => {
          if (err3) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err3.message }); });
          insertFields(id, fields, connection, (err4) => {
            if (err4) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err4.message }); });
            connection.commit((err5) => {
              connection.release();
              if (err5) return res.status(500).json({ error: err5.message });
              res.json({ message: "Cập nhật thành công" });
            });
          });
        });
      }
    );
  });
};

// ================= 4. TỌA ĐỘ FIELDS =================
exports.updateFieldCoords = (req, res) => {
  const { id } = req.params;
  const { fields } = req.body;
  if (!fields || !Array.isArray(fields)) return res.status(400).send("Dữ liệu không hợp lệ");
  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query("DELETE FROM form_fields WHERE form_id=?", [id], (err2) => {
      if (err2) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err2.message }); });
      insertFields(id, fields, connection, (err3) => {
        if (err3) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err3.message }); });
        connection.commit((err4) => {
          connection.release();
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ message: "Lưu tọa độ thành công" });
        });
      });
    });
  });
};

// ================= 5. CHI TIẾT =================
exports.getFormDetail = (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM forms WHERE form_id=?", [id], (err, formRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!formRows.length) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });
    db.query(
      "SELECT * FROM form_fields WHERE form_id=? ORDER BY placeholder_no ASC, field_id ASC", [id],
      (err2, fieldRows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ...formRows[0], fields: fieldRows });
      }
    );
  });
};

// ================= 6. DANH SÁCH =================
exports.getForms = (req, res) => {
  db.query("SELECT * FROM forms ORDER BY form_id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ================= 7. XÓA =================
exports.deleteForm = (req, res) => {
  const { id } = req.params;
  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query("DELETE FROM form_submissions WHERE form_id=?", [id], (err1) => {
      if (err1) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err1.message }); });
      connection.query("DELETE FROM form_fields WHERE form_id=?", [id], (err2) => {
        if (err2) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err2.message }); });
        connection.query("DELETE FROM forms WHERE form_id=?", [id], (err3) => {
          if (err3) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err3.message }); });
          connection.commit((err4) => {
            connection.release();
            if (err4) return res.status(500).json({ error: err4.message });
            res.json({ message: "Xóa thành công" });
          });
        });
      });
    });
  });
};

// ================= 8. CATEGORIES =================
exports.getCategories = (req, res) => {
  db.query("SELECT * FROM categories ORDER BY category_id ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};