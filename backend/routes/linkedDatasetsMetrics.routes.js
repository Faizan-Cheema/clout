import express from "express";
import pool from "../config/db.js";

const router = express.Router();

//(Insert or Update)
router.post("/save-metrics", async (req, res) => {
  const { userId, datasetId, pageType, metrics: newMetrics } = req.body;

  if (!userId || !datasetId || !pageType || !newMetrics) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Fetch existing
    const selectQuery = `
      SELECT metrics FROM linked_dataset_metrics
      WHERE user_id = $1 AND page_type = $2
      LIMIT 1;
    `;

    const { rows } = await pool.query(selectQuery, [userId, pageType]);
    const existingMetrics = rows[0]?.metrics || {};

    // to overwrite old ones
    const mergedMetrics = {
      ...existingMetrics,
      ...newMetrics
    };

    const upsertQuery = `
      INSERT INTO linked_dataset_metrics (user_id, dataset_id, page_type, metrics, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, page_type)
      DO UPDATE SET dataset_id = $2, metrics = $4, updated_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, [userId, datasetId, pageType, JSON.stringify(mergedMetrics)]);

    res.status(200).json({ message: "Metrics saved successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error saving metrics:", error);
    res.status(500).json({ error: "Error saving metrics" });
  }
});


// for a Page
router.get("/get-metrics/:userId/:pageType", async (req, res) => {
  const { userId, pageType } = req.params;

  if (!userId || !pageType) {
    return res.status(400).json({ error: "User ID and Page Type are required" });
  }

  try {
    const query = `
      SELECT dataset_id, metrics, updated_at FROM linked_dataset_metrics
      WHERE user_id = $1 AND page_type = $2
      ORDER BY updated_at DESC
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [userId, pageType]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No metrics found for this page" });
    }

    res.status(200).json({ metrics: rows[0].metrics, datasetId: rows[0].dataset_id });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Error fetching metrics" });
  }
});

// delete metrics when Unlinked Dataset 
router.delete("/delete-metrics/:userId/:pageType", async (req, res) => {
  const { userId, pageType } = req.params;

  if (!userId || !pageType) {
    return res.status(400).json({ error: "User ID and Page Type are required" });
  }

  try {
    const query = `
      DELETE FROM linked_dataset_metrics
      WHERE user_id = $1 AND page_type = $2;
    `;

    await pool.query(query, [userId, pageType]);

    res.status(200).json({ message: "Metrics deleted successfully" });
  } catch (error) {
    console.error("Error deleting metrics:", error);
    res.status(500).json({ error: "Error deleting metrics" });
  }
});

// dashboard metrics form hr dashboards
// router.get("/get-all-metrics/:userId", async (req, res) => {
//   const { userId } = req.params;

//   if (!userId) {
//     return res.status(400).json({ error: "User ID is required" });
//   }

//   try {
//     const query = `
//       SELECT page_type, dataset_id, metrics, updated_at
//       FROM linked_dataset_metrics
//       WHERE user_id = $1
//       ORDER BY updated_at DESC;
//     `;

//     const { rows } = await pool.query(query, [userId]);

//     const metricCardTitles = [
//       "Total Workforce Headcount",
//       "Total Salary Cost",
//       "Average Cost Per Employee",
//       "Attrition Rate",
//       "Time to Fill (Days)",
//       "Average Employee Tenure",
//       "Engagement Score (%)",
//       "First Year Attrition Rate",
//       "Manager-to-Employee Ratio",
//       "Average Time in Position (Years)",
//     ];

//     const graphTitles = [
//       "Department Wise Employee Headcount",
//       "Attrition Trend",
//       "Gender Wise Distribution",
//       "Engagement Score By Department",
//       "Employee Tenure Distribution",
//       "Quarter-over-Quarter Performance Trends",
//       "Absenteeism Trends",
//     ];

//     const allowedMetricKeys = ["CPMetrics", "ENMetrics", "PEMetrics", "PFMetrics", "RAMetrics"];

//     const metricsByPage = {};

//     rows.forEach((row) => {
//       const rawMetrics = row.metrics || {};

//       const filteredMetrics = {};

//       allowedMetricKeys.forEach((key) => {
//         if (Array.isArray(rawMetrics[key])) {
//           const filteredCards = rawMetrics[key].filter(item =>
//             metricCardTitles.includes(item.title)
//           );
//           if (filteredCards.length) {
//             filteredMetrics[key] = filteredCards;
//           }
//         }
//       });

//       if (Array.isArray(rawMetrics.graphs)) {
//         const filteredGraphs = rawMetrics.graphs.filter(graph =>
//           graph?.layout?.title?.text && graphTitles.includes(graph.layout.title.text)
//         );
//         if (filteredGraphs.length) {
//           filteredMetrics.graphs = filteredGraphs;
//         }
//       }

//       metricsByPage[row.page_type] = {
//         datasetId: row.dataset_id,
//         metrics: filteredMetrics,
//         updatedAt: row.updated_at,
//       };
//     });

//     res.status(200).json({ data: metricsByPage });
//   } catch (error) {
//     console.error("Error fetching refined metrics:", error);
//     res.status(500).json({ error: "Error fetching refined metrics" });
//   }
// });

// dashboard graphs from  dashboards
router.get("/get-all-graphs/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const query = `
      SELECT page_type, dataset_id, metrics, updated_at
      FROM linked_dataset_metrics
      WHERE user_id = $1
      ORDER BY updated_at DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    const graphsByPage = {};

    rows.forEach((row) => {
      const rawMetrics = row.metrics || {};

      if (Array.isArray(rawMetrics.graphs)) {
        const filteredGraphs = rawMetrics.graphs.filter(graph =>
          graph?.layout?.title?.text 
        );

        if (filteredGraphs.length > 0) {
          graphsByPage[row.page_type] = {
            datasetId: row.dataset_id,
            graphs: filteredGraphs,
            updatedAt: row.updated_at,
          };
        }
      }
    });

    res.status(200).json({ data: graphsByPage });
  } catch (error) {
    console.error("Error fetching graphs:", error);
    res.status(500).json({ error: "Error fetching graphs" });
  }
});


export default router;
