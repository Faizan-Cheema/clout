import pool from "../config/db.js";

const createDatasetsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS datasets (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        file_key TEXT NOT NULL, 
        file_url TEXT NOT NULL, 
        row_count INTEGER DEFAULT 0, 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Datasets table created (or already exists)");
  } catch (error) {
    console.error("Error creating datasets table:", error);
  }
};

export default createDatasetsTable;
