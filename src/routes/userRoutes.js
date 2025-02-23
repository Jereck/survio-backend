const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { Pool } = require("pg");

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Get all users (Only Owner/Admin)
router.get("/", authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role FROM users ORDER BY role DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ✅ Assign user to a team
router.post("/assign-team", authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  const { userId, teamId } = req.body;

  try {
    // Ensure user exists
    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure team exists
    const teamCheck = await pool.query("SELECT * FROM teams WHERE id = $1", [teamId]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Assign user to team
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, (SELECT role FROM users WHERE id = $2))",
      [teamId, userId]
    );

    res.status(200).json({ message: "User assigned to team successfully!" });
  } catch (error) {
    console.error("Error assigning user to team:", error);
    res.status(500).json({ message: "Failed to assign user to team" });
  }
});

// ✅ Change user role
router.put("/change-role", authMiddleware, roleMiddleware(["owner"]), async (req, res) => {
  const { userId, newRole } = req.body;

  try {
    if (!["viewer", "researcher", "admin"].includes(newRole)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [newRole, userId]);

    res.status(200).json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// ✅ Remove user from platform
router.delete("/:userId", authMiddleware, roleMiddleware(["owner"]), async (req, res) => {
  const { userId } = req.params;

  try {
    // Prevent owner from deleting themselves
    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userCheck.rows[0].role === "owner") {
      return res.status(403).json({ message: "Owner cannot delete themselves" });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.query("DELETE FROM team_members WHERE user_id = $1", [userId]);

    res.status(200).json({ message: "User removed successfully" });
  } catch (error) {
    console.error("Error removing user:", error);
    res.status(500).json({ message: "Failed to remove user" });
  }
});

module.exports = router;
