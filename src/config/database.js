const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for NeonDB or any managed PostgreSQL
  max: 10, // Limit the number of connections
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 2000, // Return an error if a connection takes longer than 2s
});

module.exports = pool;
