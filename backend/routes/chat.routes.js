import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Create a new chat
router.post("/create", async (req, res) => {
  const { userId, title } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  try {
    const result = await pool.query(
      `INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *;`,
      [userId, title || "Untitled Chat"]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating chat:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// Update title
router.put("/:chatId/title", async (req, res) => {
  const { chatId } = req.params;
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
      [title, chatId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating chat title:", err);
    res.status(500).json({ error: "Failed to update chat title" });
  }
});

// Add a message to a chat
router.post("/:chatId/messages", async (req, res) => {
  const { chatId } = req.params;
  const { sender, message, plots } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (chat_id, sender, message, plots) VALUES ($1, $2, $3, $4) RETURNING *;`,
      [chatId, sender, message, plots ? JSON.stringify(plots) : null]
    );

    await pool.query(
      `UPDATE chats SET updated_at = NOW() WHERE id = $1;`,
      [chatId]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: "Failed to add message" });
  }
});

// Get all chats for that user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM chats WHERE user_id = $1 ORDER BY updated_at DESC;`,
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get messages in chat
router.get("/:chatId/messages", async (req, res) => {
  const { chatId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC;`,
      [chatId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Delete a chat and its messages
router.delete("/:chatId", async (req, res) => {
  const { chatId } = req.params;

  try {
    await pool.query(`DELETE FROM chats WHERE id = $1;`, [chatId]);
    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (err) {
    console.error("Error deleting chat:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

export default router;
