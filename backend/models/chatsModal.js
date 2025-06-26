import pool from "../config/db.js";

const createChatsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Untitled Chat',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `);
    console.log("chats table created (or already exists)");
  } catch (error) {
    console.error("Error creating chats table:", error);
  }
};

export default createChatsTable;
