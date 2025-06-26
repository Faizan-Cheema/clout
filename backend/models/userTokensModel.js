import pool from "../config/db.js";

const createUserTokensTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        integration_type TEXT NOT NULL, 
        account_token TEXT NOT NULL,
        merge_access_token TEXT,
        platform_name TEXT,
        refresh_token TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, integration_type) 
      );
    `);
    console.log("User Tokens table created (or already exists)");
  } catch (error) {
    console.error("Error creating user_tokens table:", error);
  }
};

export default createUserTokensTable;
