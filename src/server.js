require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

pool.connect()
  .then(() => console.log('Connected to Neon DB'))
  .catch(err => console.error('Error connecting to Neon DB: ', err));

// Keeps the Renderer connection alive 
setInterval(async () => {
  try {
    await pool.query("SELECT 1"); // Keeps the connection alive
    console.log("✅ Database connection kept alive.");
  } catch (error) {
    console.error("⚠️ Database keep-alive error:", error);
  }
}, 60000);

const paymentRoutes = require('./routes/paymentRoutes');
const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');
const userRoutes = require('./routes/userRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const questionRoutes = require('./routes/questionRoutes');
const responseRoutes = require('./routes/responseRoutes');

app.use('/payments', paymentRoutes);
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/surveys', surveyRoutes);
app.use('/questions', questionRoutes);
app.use('/responses', responseRoutes);

app.get("/", (req, res) => {
  res.send("Survur.io API is running!");
});


const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    let event = request.body;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (endpointSecret) {
      const signature = request.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(request.body, signature, endpointSecret);
      } catch (err) {
        console.log(`⚠️ Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
    }

    let subscription, status, customerId;

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        subscription = event.data.object;
        status = subscription.status;
        customerId = subscription.customer;

        console.log(`✅ Subscription Updated: ${subscription.id} | Status: ${status}`);

        // Get user's ID from our database
        const userResult = await pool.query("SELECT id FROM users WHERE stripe_customer_id = $1", [customerId]);
        if (userResult.rows.length === 0) {
          console.log("⚠️ User not found for this Stripe customer ID");
          return response.sendStatus(400);
        }

        const userId = userResult.rows[0].id;
        const planType = subscription.items.data[0].price.lookup_key; // e.g., "free_monthly"

        // Store subscription details in the database
        await pool.query(
          "UPDATE users SET stripe_subscription_id = $1, subscription_status = $2, subscription_plan = $3 WHERE id = $4",
          [subscription.id, status, planType, userId]
        );

        break;

      case "customer.subscription.deleted":
        subscription = event.data.object;
        customerId = subscription.customer;

        console.log(`🚨 Subscription Canceled: ${subscription.id}`);

        // Find the user associated with this customer ID
        const userRes = await pool.query("SELECT id FROM users WHERE stripe_customer_id = $1", [customerId]);
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          
          // Set their status to inactive & downgrade them to Free
          await pool.query(
            "UPDATE users SET subscription_status = 'inactive', subscription_plan = 'free_monthly' WHERE id = $1",
            [userId]
          );
        }

        break;

      default:
        console.log(`Unhandled event type ${event.type}.`);
    }

    response.sendStatus(200);
  }
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})