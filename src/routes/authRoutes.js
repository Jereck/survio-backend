const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const pool = require('../config/database')
const Stripe = require("stripe");
const generateToken = require('../utils/auth')
require("dotenv").config();

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/register', async (req, res) => {
    const { email, password, username, first_name, last_name, subscription_plan } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // 🔹 Create a new Stripe customer at signup
      console.log("🔹 Creating Stripe customer for:", email);
      const customer = await stripe.customers.create({ email });

      // 🔹 Store user with Stripe customer ID
      const query = {
        text: `
          INSERT INTO users(email, password, role, username, first_name, last_name, subscription_plan, subscription_status, stripe_customer_id) 
          VALUES($1, $2, 'owner', $3, $4, $5, $6, 'pending_payment', $7) RETURNING *`,
        values: [email, hashedPassword, username, first_name, last_name, subscription_plan, customer.id],
      };
      const result = await pool.query(query);

      const newUser = result.rows[0];

      console.log("✅ User Registered with Stripe Customer ID:", customer.id);

      const token = generateToken(newUser);

      res.status(201).json({ user: newUser, token, message: "User registered, proceed to payment." });
    } catch (error) {
      console.error("Signup Error:", error);
      res.status(500).json({ error: error.message });
    }
});

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body;

    try {
      const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  
      if (userCheck.rows.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
  
      const user = userCheck.rows[0];
  
      // Prevent login if user hasn't set a password
      if (user.needs_password_setup) {
        return res.status(403).json({ message: "You must set a password before logging in." });
      }
  
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
  
      const token = generateToken(user);
      res.json({ token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to log in" });
    }
  }
);

router.post("/set-password", async (req, res) => {
  const { userId, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new password and remove needs_password_setup flag
    await pool.query(
      "UPDATE users SET password = $1, needs_password_setup = false WHERE id = $2",
      [hashedPassword, userId]
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error setting password:", error);
    res.status(500).json({ message: "Failed to set password" });
  }
});

module.exports = router;