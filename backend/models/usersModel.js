import pool from "../config/db.js";

const createUsersTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        organization TEXT NOT NULL,
        stripe_customer_id TEXT
      );
    `);
    
    // Add stripe_customer_id column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      `);
    } catch (error) {
      // Column might already exist, ignore error
    }
    
    console.log("Users table created (or already exists)");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
};

export default createUsersTable;
