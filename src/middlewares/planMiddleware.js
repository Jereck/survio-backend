const pool = require("../config/database");

const enforcePlanLimits = async (req, res, next) => {
  const userId = req.user.userId;

  // Find the owner's ID and plan
  const ownerResult = await pool.query(
    "SELECT owner_id, subscription_plan FROM users WHERE id = $1",
    [userId]
  );

  if (ownerResult.rows.length === 0) {
    return res.status(403).json({ message: "User not found" });
  }

  const ownerId = ownerResult.rows[0].owner_id || userId;
  const subscriptionPlan = ownerResult.rows[0].subscription_plan;

  const planLimits = { free_monthly: 2, hobby_monthly: 5, pro_monthly: 100 };
  const maxSeats = planLimits[subscriptionPlan] || 2;

  // Count team members linked to this owner
  const memberCount = await pool.query(
    "SELECT COUNT(*) FROM users WHERE owner_id = $1",
    [ownerId]
  );

  if (parseInt(memberCount.rows[0].count) >= maxSeats) {
    return res.status(403).json({ message: "Seat limit reached. Upgrade to add more members." });
  }

  next();
};

module.exports = enforcePlanLimits;
