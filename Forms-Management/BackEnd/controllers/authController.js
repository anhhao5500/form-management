const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Missing data" });
  }

  const hashed = bcrypt.hashSync(password, 10);

  const sql = `
    INSERT INTO users (full_name, email, password, role_id)
    VALUES (?, ?, ?, 2)
  `;

  db.query(sql, [full_name, email, hashed], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Register success" });
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Lỗi Server" });
    if (rows.length === 0)
      return res.status(401).json({ message: "Email không tồn tại" });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Sai mật khẩu" });

    // Cập nhật last_login
    db.query(
      "UPDATE users SET last_login=NOW() WHERE user_id=?",
      [user.user_id]
    );

    const token = jwt.sign(
      { user_id: user.user_id, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Trả về ĐẦY ĐỦ thông tin để frontend lưu localStorage
    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
        phone: user.phone || null,
        address: user.address || null,
        dob: user.dob || null,
      },
    });
  });
};