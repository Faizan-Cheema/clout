import pool from "../config/db.js";

const createChatMessagesTable = async () => {
  try {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    message TEXT,
    plots JSONB, -- optional, only for assistant messages
    created_at TIMESTAMP DEFAULT NOW()
  )
    `);
    console.log("chat_messages table created (or already exists)");
  } catch (error) {
    console.error("Error creating chat_messages table:", error);
  }
};

export default createChatMessagesTable;
