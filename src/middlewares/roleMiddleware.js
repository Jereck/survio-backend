module.exports = (allowedRoles) => (req, res, next) => {
  console.log("Authenticated User Role:", req.user.role);
  console.log("Allowed Roles:", allowedRoles);

  if (!allowedRoles.includes(req.user.role)) {
    console.log("❌ Access Denied: User does not have the required role.");
    return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
  }

  next();
};
