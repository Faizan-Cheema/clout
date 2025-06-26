import express from "express";
import pool from "../config/db.js";
import puppeteer from "puppeteer";
import { setTimeout } from "node:timers/promises";

const router = express.Router();


// Save/ update Report
router.post("/save-report", async (req, res) => {
  const { userId, reportId, title, content } = req.body;

  if (!userId || !title || !content) {
    return res.status(400).json({ error: "User ID, title, and content are required" });
  }

  try {
    let result;

    if (reportId) {
      // Update existing
      const updateQuery = `
        UPDATE reports
        SET title = $1, content = $2, updated_at = NOW()
        WHERE id = $3 AND user_id = $4
        RETURNING *;
      `;
      result = await pool.query(updateQuery, [title, content, reportId, userId]);
    } else {
      // Create new
      const insertQuery = `
        INSERT INTO reports (user_id, title, content)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      result = await pool.query(insertQuery, [userId, title, content]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No report updated or created" });
    }

    res.status(200).json({ message: "Report saved", data: result.rows[0] });
  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({ error: "Error saving report" });
  }
});


// to fetch a report
router.get("/get-report/:userId/:reportId", async (req, res) => {
  const { userId, reportId } = req.params;

  if (!userId || !reportId) {
    return res.status(400).json({ error: "User ID and Report ID are required" });
  }

  try {
    const query = `
      SELECT * FROM reports
      WHERE user_id = $1 AND id = $2;
    `;

    const { rows } = await pool.query(query, [userId, reportId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Error fetching report" });
  }
});



router.delete("/delete-report/:userId/:reportId", async (req, res) => {
  const { userId, reportId } = req.params;

  try {
    const deleteQuery = `
      DELETE FROM reports
      WHERE user_id = $1 AND id = $2;
    `;

    const result = await pool.query(deleteQuery, [userId, reportId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Error deleting report" });
  }
});


// Get all reports for that user
router.get("/get-reports/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const query = `
      SELECT id, title, created_at, updated_at
      FROM reports
      WHERE user_id = $1
      ORDER BY updated_at DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    res.status(200).json({ reports: rows });
  } catch (error) {
    console.error("Error fetching user reports:", error);
    res.status(500).json({ error: "Error fetching reports" });
  }
});


router.post("/generate-pdf", async (req, res) => {
  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ error: "Missing HTML" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log('Executable path:', puppeteer.executablePath());

    const page = await browser.newPage();

    await page.setViewport({ width: 794, height: 1123 });


    await page.emulateMediaType("screen");

    await page.setContent(html, { waitUntil: ["load", "networkidle0"] });

  await page.evaluate(async () => {
  await document.fonts.ready;

  const allElems = document.querySelectorAll("*");
  allElems.forEach((el) => {
    const style = getComputedStyle(el);
    let cssText = "";
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      cssText += `${prop}:${style.getPropertyValue(prop)};`;
    }
    el.setAttribute("style", cssText);
  });
});
    await setTimeout(500);

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top:    "10mm",
        right:  "10mm",
        bottom: "10mm",
        left:   "10mm",
      },
    });


    res.writeHead(200, {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="report.pdf"`,
      "Content-Length":      pdfBuffer.length,
    });
    res.end(pdfBuffer, "binary");           
  } catch (err) {
    console.error("PDF gen error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
