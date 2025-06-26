import pool from "../config/db.js";

const createReportsTable = async () => {
  try {
    await pool.query(`
   CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  ); `);
    console.log("reports table created (or already exists)");
  } catch (error) {
    console.error("Error creating reports table:", error);
  }
};

export default createReportsTable;
