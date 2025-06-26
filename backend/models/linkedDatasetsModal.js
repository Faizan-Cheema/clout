import pool from "../config/db.js";

const createLinkedDatasetsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linked_datasets (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      page_type TEXT NOT NULL, 
      linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, page_type) 
    );

   `);
    console.log("LinkedDatasets table created (or already exists)");
  } catch (error) {
    console.error("Error creating linked_datasets table:", error);
  }
};

export default createLinkedDatasetsTable;
