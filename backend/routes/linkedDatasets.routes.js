import express from "express";
import pool from "../config/db.js";

const router = express.Router();


router.post('/link-dataset', async (req, res) => {
  const { userId, datasetId, pageType } = req.body;

  if (!userId || !datasetId || !pageType) {
    return res.status(400).json({ error: 'User ID, Dataset ID, and Page Type are required.' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); 

    await client.query(
      `DELETE FROM linked_datasets WHERE user_id = $1 AND page_type = $2`,
      [userId, pageType]
    );

    // Remove metrics since dataset is changing
    await client.query(
      `DELETE FROM linked_dataset_metrics WHERE user_id = $1 AND page_type = $2`,
      [userId, pageType]
    );

    const query = `
      INSERT INTO linked_datasets (user_id, dataset_id, page_type)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const values = [userId, datasetId, pageType];
    const result = await client.query(query, values);

    await client.query('COMMIT'); 
    res.status(200).json({ message: 'Dataset linked successfully, old metrics removed.', linkId: result.rows[0].id });

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Error linking dataset:', error);
    res.status(500).json({ error: 'Error linking dataset.' });

  } finally {
    client.release(); 
  }
});



router.delete('/unlink-dataset', async (req, res) => {
  const { userId, datasetId, pageType } = req.body;

  if (!userId || !datasetId || !pageType) {
    return res.status(400).json({ error: 'User ID, Dataset ID, and Page Type are required.' });
  }

  try {
    const query = `
      DELETE FROM linked_datasets
      WHERE user_id = $1 AND dataset_id = $2 AND page_type = $3;
    `;
    await pool.query(query, [userId, datasetId, pageType]);

    res.status(200).json({ message: 'Dataset unlinked successfully.' });
  } catch (error) {
    console.error('Error unlinking dataset:', error);
    res.status(500).json({ error: 'Error unlinking dataset.' });
  }
});


router.get('/get-linked-datasets/:userId/:pageType', async (req, res) => {
  const { userId, pageType } = req.params;

  if (!userId || !pageType) {
    return res.status(400).json({ error: "User ID and Page Type are required." });
  }

  try {
    const query = `
      SELECT d.id, d.endpoint, d.file_url, d.row_count, d.created_at, ld.page_type
      FROM linked_datasets ld
      JOIN datasets d ON ld.dataset_id = d.id
      WHERE ld.user_id = $1 AND ld.page_type = $2
      ORDER BY ld.linked_at DESC;
    `;
    const result = await pool.query(query, [userId, pageType]);

    res.status(200).json({ linkedDatasets: result.rows });
  } catch (error) {
    console.error("Error fetching linked datasets:", error);
    res.status(500).json({ error: "Error fetching linked datasets." });
  }
});

export default router;
