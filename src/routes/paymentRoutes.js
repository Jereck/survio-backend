const express = require("express");
const Stripe = require("stripe");
const authMiddleware = require("../middlewares/authMiddleware");
const pool = require('../config/database');
require("dotenv").config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", authMiddleware, async (req, res) => {
  try {
    const { lookup_key } = req.body;
    const userId = req.user.userId;

    // Fetch user details from the database
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = userResult.rows[0];

    let stripeCustomerId = user.stripe_customer_id;

    // If user has no Stripe customer ID, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });

      stripeCustomerId = customer.id;

      // Store the Stripe customer ID in the database
      await pool.query(
        "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
        [stripeCustomerId, userId]
      );
    }

    // Fetch price using the lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [lookup_key],
      expand: ["data.product"],
    });

    if (!prices.data.length) {
      console.error("❌ Stripe Error: Price not found for lookup key", lookup_key);
      return res.status(404).json({ message: "Price not found" });
    }

    const priceId = prices.data[0].id;

    // Create a Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      billing_address_collection: "auto",
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    });

    console.log("✅ Stripe Checkout Session Created:", session);
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
