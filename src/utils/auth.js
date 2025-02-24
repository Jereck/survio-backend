const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role, 
      username: user.username, 
      first_name: user.first_name, 
      last_name: user.last_name, 
      subscription_plan: user.subscription_plan, 
      subscription_status: user.subscription_status, 
      stripe_customer_id: user.stripe_customer_id 
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Token valid for 7 days
  );
};

module.exports = generateToken;
