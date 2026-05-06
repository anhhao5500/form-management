const db = require("../config/db");
const bcrypt = require("bcryptjs");

// ================= 1. LẤY TẤT CẢ USER (ADMIN) =================
exports.getAllUsers = (req, res) => {
  db.query(
    "SELECT user_id, full_name, email, role_id, phone, address, dob, created_at FROM users",
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

// ================= 2. TẠO USER MỚI =================
exports.createUser = async (req, res) => {
  const { full_name, email, password, role_id } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.query(
    "INSERT INTO users (full_name, email, password, role_id) VALUES (?, ?, ?, ?)",
    [full_name, email, hashed, role_id || 2],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "User created" });
    }
  );
};

// ================= 3. CẬP NHẬT USER (ADMIN) =================
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, password, role_id } = req.body;

  let sql = "UPDATE users SET full_name=?, email=?, role_id=?";
  let params = [full_name, email, role_id];

  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    sql += ", password=?";
    params.push(hashed);
  }
  sql += " WHERE user_id=?";
  params.push(id);

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated" });
  });
};

// ================= 4. XÓA USER =================
exports.deleteUser = (req, res) => {
  const { id } = req.params;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json(err);

    conn.beginTransaction((err1) => {
      if (err1) {
        conn.release();
        return res.status(500).json(err1);
      }

      conn.query(
        "DELETE FROM user_form_interactions WHERE user_id=?",
        [id],
        (err0) => {
          if (err0) return conn.rollback(() => {
            conn.release();
            res.status(500).json(err0);
          });

          conn.query(
            "DELETE FROM form_submissions WHERE user_id=?",
            [id],
            (err2) => {
              if (err2) return conn.rollback(() => {
                conn.release();
                res.status(500).json(err2);
              });

              conn.query(
                "DELETE FROM users WHERE user_id=?",
                [id],
                (err3) => {
                  if (err3) return conn.rollback(() => {
                    conn.release();
                    res.status(500).json(err3);
                  });

                  conn.commit((err4) => {
                    conn.release();
                    if (err4) return res.status(500).json(err4);
                    res.json({ message: "Deleted" });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};

// ================= 5. LẤY PROFILE & LỊCH SỬ =================
exports.getUserProfile = (req, res) => {
  const cleanId = req.params.id.replace(":", "");

  db.query(
    "SELECT user_id, full_name, email, phone, address, dob, role_id, created_at FROM users WHERE user_id = ?",
    [cleanId],
    (err, userRows) => {
      if (err) return res.status(500).json({ message: "Lỗi database" });
      if (!userRows.length)
        return res.status(404).json({ message: "Không tìm thấy user" });

      db.query(
        `SELECT fs.submission_id, f.title AS form_title, fs.submitted_at
         FROM form_submissions fs
         LEFT JOIN forms f ON fs.form_id = f.form_id
         WHERE fs.user_id = ?
         ORDER BY fs.submitted_at DESC`,
        [cleanId],
        (err2, historyRows) => {
          if (err2) return res.status(500).json(err2);
          res.json({ user: userRows[0], history: historyRows || [] });
        }
      );
    }
  );
};

// ================= 6. CẬP NHẬT PROFILE =================
exports.updateOwnProfile = (req, res) => {
  const cleanId = req.params.id.replace(":", "");
  const { dob, address, full_name } = req.body;

  // Chỉ cho phép số điện thoại chứa chữ số
  const rawPhone = req.body.phone;
  if (rawPhone !== undefined && rawPhone !== null && rawPhone !== "") {
    const phoneStr = String(rawPhone).trim();
    if (!/^\d+$/.test(phoneStr)) {
      return res.status(400).json({
        message: "Số điện thoại chỉ được chứa chữ số",
      });
    }
  }

  console.log("Đang cập nhật ID:", cleanId, "Data:", req.body);

  const sql = `
    UPDATE users 
    SET phone = ?, dob = ?, address = ?,
        full_name = IF(? IS NOT NULL AND ? != '', ?, full_name)
    WHERE user_id = ?
  `;

  db.query(
    sql,
    [
      rawPhone || null,
      dob || null,
      address || null,
      full_name, full_name, full_name || null,
      cleanId,
    ],
    (err, result) => {
      if (err) {
        console.error("Lỗi SQL:", err);
        return res.status(500).json({ message: "Lỗi database khi update" });
      }
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Không tìm thấy user" });

      db.query(
        "SELECT user_id, full_name, email, phone, address, dob, role_id FROM users WHERE user_id = ?",
        [cleanId],
        (err2, rows) => {
          if (err2) return res.status(500).json(err2);
          console.log("Cập nhật thành công:", rows[0]);
          res.json({ message: "Cập nhật thành công!", user: rows[0] });
        }
      );
    }
  );
};

// ================= 7. LOG TƯƠNG TÁC FORM =================
exports.logInteraction = (req, res) => {
  const { user_id, form_id, action = "view" } = req.body;
  if (!user_id || !form_id)
    return res.status(400).json({ message: "Thiếu user_id hoặc form_id" });

  db.query(
    "INSERT INTO user_form_interactions (user_id, form_id, action, interacted_at) VALUES (?, ?, ?, NOW())",
    [user_id, form_id, action],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "OK" });
    }
  );
};

// ================= 8. PERSONAL FORMS (phân trang + tìm kiếm) =================
exports.getPersonalForms = (req, res) => {
  const userId   = req.params.userId;
  const page     = parseInt(req.query.page)  || 1;
  const limit    = parseInt(req.query.limit) || 5;
  const search   = req.query.search   || "";
  const category = req.query.category || "";
  const offset   = (page - 1) * limit;

  let where = "WHERE ufi.user_id = ?";
  const params = [userId];

  if (search)   { where += " AND f.title LIKE ?";      params.push(`%${search}%`); }
  if (category) { where += " AND f.category_id = ?";   params.push(category); }

  db.query(
    `SELECT COUNT(DISTINCT ufi.form_id) AS total
     FROM user_form_interactions ufi
     JOIN forms f ON ufi.form_id = f.form_id
     ${where}`,
    params,
    (err, countRows) => {
      if (err) return res.status(500).json(err);
      const total = countRows[0].total;

      db.query(
        `SELECT 
           f.form_id, f.title, f.category_id,
           c.name AS category_name,
           MAX(ufi.interacted_at) AS last_interacted_at,
           COUNT(DISTINCT fs.submission_id) AS submission_count,
           MAX(fs.submission_id) AS last_submission_id
         FROM user_form_interactions ufi
         JOIN forms f ON ufi.form_id = f.form_id
         LEFT JOIN categories c ON f.category_id = c.category_id
         LEFT JOIN form_submissions fs 
           ON fs.form_id = f.form_id AND fs.user_id = ufi.user_id
         ${where}
         GROUP BY f.form_id, f.title, f.category_id, c.name
         ORDER BY last_interacted_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
        (err2, rows) => {
          if (err2) return res.status(500).json(err2);
          res.json({
            data: rows,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            },
          });
        }
      );
    }
  );
};