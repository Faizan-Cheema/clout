import pool from "../config/db.js";

const createLinkedDatasetsMetricsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linked_dataset_metrics (
    id SERIAL PRIMARY KEY,
    dataset_id INT REFERENCES datasets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    page_type TEXT NOT NULL,
    metrics JSONB NOT NULL, 
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, page_type)
    );
   `);
    console.log("linked_dataset_metrics table created (or already exists)");
  } catch (error) {
    console.error("Error creating linked_dataset_metrics table:", error);
  }
};

export default createLinkedDatasetsMetricsTable;
