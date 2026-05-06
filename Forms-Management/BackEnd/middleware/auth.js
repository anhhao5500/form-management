const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("AUTH HEADER:", authHeader?.substring(0, 30));

  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED:", decoded);
    req.user = decoded;
    next();
  } catch (e) {
    console.log("TOKEN ERROR:", e.message);
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
    res.status(403).json({ message: "Invalid token" });
  }
};