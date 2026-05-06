require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); 
const authRoutes = require("./routes/authRoutes");
const formRoutes = require("./routes/formRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const userRoutes = require("./routes/userRoutes");
console.log("JWT_SECRET:", process.env.JWT_SECRET);
const app = express();

app.use(cors());
app.use(express.json());

// 🔥 QUAN TRỌNG: Cấu hình thư mục 'uploads' để có thể truy cập file PDF qua URL
// Ví dụ: http://localhost:5000/uploads/ten-file-pdf.pdf
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/forms", formRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});