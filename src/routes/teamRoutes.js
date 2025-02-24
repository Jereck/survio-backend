const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require("bcrypt");
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const sendEmail = require('../utils/email');
const pool = require('../config/database');

const router = express.Router();


// ✅ Get all teams the user is part of
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT teams.* FROM teams
       LEFT JOIN team_members ON teams.id = team_members.team_id
       WHERE teams.owner_id = $1 OR team_members.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// ✅ Get a specific team by ID
router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT * FROM teams 
       WHERE id = $1 AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2
       ))`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Team not found or access denied" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// ✅ Create a new team
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const ownerId = req.user.userId;

  try {
    const result = await pool.query(
      'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *', 
      [name, ownerId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating team: ", error);
    res.status(500).json({ message: 'Failed to create team' });
  }
});

// ✅ Invite a user to the team
router.post("/invite", authMiddleware, async (req, res) => {
  const { email, role } = req.body;
  const ownerId = req.user.userId;

  try {
    // Ensure the requestor is an Owner
    const ownerCheck = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'owner'", [ownerId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ message: "Only Owners can invite members" });
    }

    // Generate an invite token
    const token = crypto.randomBytes(32).toString("hex");

    // Store the invite in the database (without assigning a team yet)
    await pool.query(
      "INSERT INTO team_invites (email, role, token) VALUES ($1, $2, $3)",
      [email, role, token]
    );

    // Send invite email
    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
    await sendEmail(email, "You're invited to join!", `Click to accept: ${inviteLink}`);

    res.status(200).json({ message: "Invite sent successfully!" });
  } catch (error) {
    console.error("Error sending invite:", error);
    res.status(500).json({ message: "Failed to send invite" });
  }
});


// ✅ Accept an invite to join a team
router.post("/accept-invite", async (req, res) => {
  const { token } = req.body;

  try {
    // Find the invite
    const inviteCheck = await pool.query("SELECT * FROM team_invites WHERE token = $1", [token]);
    if (inviteCheck.rows.length === 0) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const { team_id, email, role } = inviteCheck.rows[0];

    // Ensure user exists or create new one
    let userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    let userId;
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        "INSERT INTO users (email, role, needs_password_setup) VALUES ($1, $2, true) RETURNING *",
        [email, role]
      );
      userId = userResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Find the owner of this team (assumes each team has one owner)
    const ownerResult = await pool.query(
      "SELECT users.id, users.stripe_subscription_id FROM users JOIN teams ON users.id = teams.owner_id WHERE teams.id = $1",
      [team_id]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(500).json({ message: "Owner not found for this team" });
    }

    const { id: ownerId, stripe_subscription_id } = ownerResult.rows[0];

    // Ensure the team doesn't exceed seat limits
    const memberCount = await pool.query(
      "SELECT COUNT(*) FROM users WHERE owner_id = $1",
      [ownerId]
    );

    const planLimits = { free_monthly: 2, hobby_monthly: 5, pro_monthly: 100 };
    const ownerPlan = await pool.query(
      "SELECT subscription_plan FROM users WHERE id = $1",
      [ownerId]
    );

    const maxSeats = planLimits[ownerPlan.rows[0].subscription_plan] || 2; // Default to 2 for safety

    if (parseInt(memberCount.rows[0].count) >= maxSeats) {
      return res.status(403).json({ message: "Seat limit reached. Upgrade plan to add more members." });
    }

    // Add user to the team and associate with subscription
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)",
      [team_id, userId, role]
    );

    // Link the new user to the owner's subscription
    await pool.query(
      "UPDATE users SET owner_id = $1, stripe_subscription_id = $2 WHERE id = $3",
      [ownerId, stripe_subscription_id, userId]
    );

    // Delete the invite
    await pool.query("DELETE FROM team_invites WHERE token = $1", [token]);

    res.status(200).json({ message: "Invite accepted successfully" });
  } catch (error) {
    console.error("Error accepting invite: ", error);
    res.status(500).json({ message: "Failed to join team" });
  }
});

router.post("/assign-team", authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  const { userId, teamId } = req.body;

  try {
    // Ensure the user exists
    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure the team exists
    const teamCheck = await pool.query("SELECT * FROM teams WHERE id = $1", [teamId]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if the user is already assigned to this team
    const existingAssignment = await pool.query(
      "SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, userId]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ message: "User is already assigned to this team" });
    }

    // Assign the user to the team
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


// ✅ Get all team members of a specific team
router.get("/:teamId/members", authMiddleware, async (req, res) => {
  const { teamId } = req.params;

  try {
    const result = await pool.query(
      `SELECT users.id, users.email, team_members.role FROM team_members 
       JOIN users ON team_members.user_id = users.id 
       WHERE team_members.team_id = $1`,
      [teamId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ message: "Failed to fetch team members" });
  }
});

// ✅ Change Team Member Role (Only Owner/Admin can do this)
router.put("/members/:memberId", authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  const { memberId } = req.params;
  const { newRole } = req.body;
  const userId = req.user.userId;

  try {
    // Ensure the user making the request is part of the team
    const checkUser = await pool.query(
      "SELECT teams.owner_id FROM teams INNER JOIN team_members ON teams.id = team_members.team_id WHERE team_members.id = $1 AND (teams.owner_id = $2 OR team_members.user_id = $2 AND team_members.role = 'admin')",
      [memberId, userId]
    );

    if (checkUser.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized to change roles" });
    }

    // Update the role
    await pool.query("UPDATE team_members SET role = $1 WHERE id = $2", [newRole, memberId]);

    res.status(200).json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Error updating team member role:", error);
    res.status(500).json({ error: "Failed to update team member role" });
  }
});

router.delete("/members/:memberId", authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.userId;

  try {
    console.log(`🔍 Checking if user ${userId} can remove member ${memberId}...`);

    // Step 1: Get the team ID for the member being removed
    const teamQuery = await pool.query(
      `SELECT team_id, user_id FROM team_members WHERE id = $1`, 
      [memberId]
    );

    if (teamQuery.rows.length === 0) {
      console.log("❌ No team found for this member. Possible data issue.");
      return res.status(404).json({ error: "Team not found for this member." });
    }

    const { team_id, user_id: removedUserId } = teamQuery.rows[0];
    console.log(`🔎 Member belongs to Team ID: ${team_id}, User ID: ${removedUserId}`);

    // Step 2: Check if the requester is the team owner or an admin
    const checkUser = await pool.query(
      `SELECT id FROM teams 
       WHERE id = $1 
       AND (owner_id = $2 
       OR EXISTS (SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = 'admin'))`,
      [team_id, userId]
    );

    console.log("🔎 Query Result:", checkUser.rows);

    if (checkUser.rows.length === 0) {
      console.log("❌ User does not have permission to remove members.");
      return res.status(403).json({ error: "Unauthorized to remove members" });
    }

    // Step 3: Prevent removing the owner
    const ownerCheck = await pool.query(
      `SELECT owner_id FROM teams WHERE id = $1`, 
      [team_id]
    );

    if (ownerCheck.rows.length > 0 && ownerCheck.rows[0].owner_id === removedUserId) {
      console.log("❌ Cannot remove the team owner.");
      return res.status(403).json({ error: "Cannot remove the team owner." });
    }

    console.log(`✅ User ${userId} has permission to remove member ${memberId}. Deleting...`);

    // Step 4: Delete the team member
    await pool.query("DELETE FROM team_members WHERE id = $1", [memberId]);

    res.status(200).json({ message: "Team member removed successfully" });
  } catch (error) {
    console.error("Error removing team member:", error);
    res.status(500).json({ error: "Failed to remove team member" });
  }
});



module.exports = router;