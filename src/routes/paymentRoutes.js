const express = require("express");
const Stripe = require("stripe");
const pool = require('../config/database');
require("dotenv").config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", async (req, res) => {
  const { user_id, lookup_key } = req.body;

  try {
    // Fetch user from database
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // 🔹 Use existing Stripe customer ID (DO NOT CREATE A NEW CUSTOMER)
    const customerId = user.stripe_customer_id;
    if (!customerId) {
      console.error("❌ Stripe customer ID missing in database!");
      return res.status(500).json({ message: "Stripe customer ID missing" });
    }

    console.log("🔹 Using existing Stripe customer ID:", customerId);

    // Fetch price from Stripe using lookup_key
    const prices = await stripe.prices.list({
      lookup_keys: [lookup_key],
      expand: ["data.product"],
    });

    if (!prices.data.length) {
      console.error("❌ Stripe Error: Price not found for lookup key", lookup_key);
      return res.status(404).json({ message: "Price not found" });
    }

    const priceId = prices.data[0].id;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      billing_address_collection: "auto",
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    });

    // 🔥 Set subscription as "pending_payment" until webhook updates it
    await pool.query(
      "UPDATE users SET subscription_plan = $1, subscription_status = 'pending_payment' WHERE id = $2",
      [lookup_key, user_id]
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe Checkout Error:", error);
    res.status(500).json({ message: "Failed to create Stripe session" });
  }
});


router.post('/create-portal-session', async (req, res) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  const { session_id } = req.body;
  const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

  // This is the url to which the customer will be redirected when they're done
  // managing their billing with the portal.
  const returnUrl = process.env.FRONTEND_URL;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: checkoutSession.customer,
    return_url: returnUrl,
  });

  res.redirect(303, portalSession.url);
});

module.exports = router;
