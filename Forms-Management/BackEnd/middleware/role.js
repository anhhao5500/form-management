exports.isAdmin = (req, res, next) => {
  console.log("IS ADMIN CHECK:", req.user);
  if (req.user.role_id !== 1) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};