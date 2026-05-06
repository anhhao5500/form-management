import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function FormList() {
  const [forms, setForms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/forms").then(res => setForms(res.data));
    api.get("/forms/categories/list").then(res => setCategories(res.data));
  }, []);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.category_id] = c.name));
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    return forms.filter(f => {
      const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        selectedCategory === "" ||
        String(f.category_id) === String(selectedCategory);
      return matchSearch && matchCategory;
    });
  }, [forms, search, selectedCategory]);

  // ===== STYLE =====
  const styles = {
    page: {
      padding: "24px",
      background: "#f6fcfd",
      minHeight: "100vh",
      fontFamily: "Segoe UI"
    },
    container: {
      maxWidth: "1100px",
      margin: "auto"
    },
    title: {
      fontSize: "28px",
      fontWeight: "bold",
      marginBottom: "20px",
      color: "#16323a"
    },
    toolbar: {
      display: "flex",
      gap: "10px",
      marginBottom: "20px",
      flexWrap: "wrap"
    },
    input: {
      flex: 1,
      padding: "10px",
      borderRadius: "10px",
      border: "1px solid #d7ecef"
    },
    select: {
      minWidth: "200px",
      padding: "10px",
      borderRadius: "10px",
      border: "1px solid #d7ecef"
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    },
    card: {
      background: "#fff",
      borderRadius: "16px",
      border: "1px solid #d7ecef",
      padding: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      transition: "0.2s"
    },
    cardTitle: {
      fontWeight: "600",
      marginBottom: "6px"
    },
    tag: {
      background: "#e5f8fa",
      color: "#43bfc9",
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "13px"
    },
    button: {
      padding: "8px 14px",
      borderRadius: "10px",
      border: "1px solid #43bfc9",
      background: "#fff",
      color: "#43bfc9",
      cursor: "pointer"
    },
    empty: {
      textAlign: "center",
      color: "#aaa",
      padding: "40px"
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <h1 style={styles.title}>THƯ VIỆN BIỂU MẪU</h1>

        {/* SEARCH + FILTER */}
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Tìm kiếm biểu mẫu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={styles.select}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map(c => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* LIST */}
        <div style={styles.list}>
          {filtered.length === 0 && (
            <div style={styles.empty}>
              Không tìm thấy biểu mẫu nào
            </div>
          )}

          {filtered.map(f => (
            <div key={f.form_id} style={styles.card}>
              <div>
                <div style={styles.cardTitle}>{f.title}</div>
                <span style={styles.tag}>
                  📁 {categoryMap[f.category_id] || "Chưa phân loại"}
                </span>
              </div>

              <button
                style={styles.button}
                onClick={() => navigate(`/form/${f.form_id}`)}
              >
                Xem chi tiết
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}