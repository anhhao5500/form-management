import React, { useMemo } from "react";

const NOTE_RE = /ghi\s*chú/i;
const PLACEHOLDER_RE = /(\(\d+\))|(\.{5,})/g;

function parseStyle(styleString = "") {
  if (!styleString) return {};
  return styleString.split(";").reduce((acc, rule) => {
    const [rawKey, ...rest] = rule.split(":");
    if (!rawKey || rest.length === 0) return acc;

    const key = rawKey.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = rest.join(":").trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

/**
 * Component InputField xử lý việc nhập liệu.
 * Tự động nhận diện Ngày/Tháng/Năm để giới hạn chỉ nhập số và co giãn chiều rộng.
 */
function InputField({ value = "", onChange, fieldName }) {
  const nameLower = fieldName?.toLowerCase() || "";
  
  // Kiểm tra xem có phải ô ngày/tháng/năm không
  const isDate = nameLower.match(/ngay|thang|nam|day|month|year/i);

  const handleChange = (e) => {
    let val = e.target.value;
    if (isDate) {
      val = val.replace(/[^0-9]/g, ""); // Chỉ cho nhập số
      const isYear = nameLower.includes("nam") || nameLower.includes("year");
      val = isYear ? val.slice(0, 4) : val.slice(0, 2);
    }
    onChange(fieldName, val); // Cập nhật về State của trang cha
  };

  return (
    <input
      value={value ?? ""}
      onChange={handleChange}
      style={{
        border: "none",
        borderBottom: "1px solid #1976d2",
        backgroundColor: "#fffde7",
        width: isDate ? (nameLower.includes("nam") ? "55px" : "35px") : "120px",
        textAlign: "center",
        outline: "none",
        fontFamily: "inherit",
        fontSize: "inherit"
      }}
    />
  );
}

function renderTextNode(text, ctx, path, allowFill) {
  if (!allowFill) return text;
  const { values, fieldMapByNo, onChange, preview } = ctx;
  const result = [];
  let lastIndex = 0;
  let match;
  let index = 0;
  PLACEHOLDER_RE.lastIndex = 0;

  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    const [fullMatch, numberMatch, dotsMatch] = match;
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (numberMatch) {
      const no = fullMatch.slice(1, -1);
      const field = fieldMapByNo[String(no)];
      result.push(
        field ? (
          <InputField
            key={`${path}-${index}`}
            value={values[field.field_name]}
            fieldName={field.field_name}
            label={no}
            preview={preview}
            onChange={onChange}
          />
        ) : (
          <span key={`${path}-err-${index}`} style={{ color: "red" }}>{fullMatch}</span>
        )
      );
    } else if (dotsMatch) {
      result.push(
        <span key={`${path}-dot-${index}`} style={{
          display: "inline-block",
          minWidth: 120,
          borderBottom: "1px dashed #999"
        }} />
      );
    }
    lastIndex = PLACEHOLDER_RE.lastIndex;
    index++;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function renderNode(node, ctx, path, allowFill = true) {
  if (node.nodeType === Node.TEXT_NODE) {
    const content = node.textContent;
    if (!content.trim()) return null;
    return renderTextNode(content, ctx, path, allowFill);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.nodeName.toLowerCase();
  const props = { key: path };
  if (node.hasAttributes()) {
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name === "style") props.style = parseStyle(attr.value);
      else if (attr.name === "class") props.className = attr.value;
      else props[attr.name] = attr.value;
    });
  }

  const isNote = NOTE_RE.test(node.textContent);
  const nextAllowFill = allowFill && !isNote;
  const children = Array.from(node.childNodes)
    .map((child, i) => renderNode(child, ctx, `${path}-${i}`, nextAllowFill))
    .filter(Boolean);

  return React.createElement(tag, props, ...children);
}

export default function TemplateRenderer({
  html = "",
  values = {},
  onChange,
  fieldMapByNo = {},
  preview = false
}) {
  const tree = useMemo(() => {
    const parser = new DOMParser();
    const cleanHTML = html.replace(/>\s+</g, "><");
    const doc = parser.parseFromString(`<div>${cleanHTML}</div>`, "text/html");
    return doc.body.firstChild;
  }, [html]);

  if (!tree) return null;

  return (
    <div style={{ lineHeight: 1.8 }}>
      {Array.from(tree.childNodes).map((node, i) =>
        renderNode(
          node,
          { values, onChange, fieldMapByNo, preview },
          `root-${i}`
        )
      )}
    </div>
  );
}