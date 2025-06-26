import express from "express";
import { MergeClient } from "@mergeapi/merge-node-client";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();
const router = express.Router();

const merge = new MergeClient({
  apiKey: process.env.MERGE_API_KEY,
});

const endpoints = [
  "benefits",
  "companies",
  "deductions",
  "employee-payroll-runs",
  "employees",
  "groups",
  "employments",
  "issues",
  "locations",
  "pay-groups",
  "payroll-runs",
  "time-off",
  "time-off-balances",
  "timesheet-entries",
  "employer-benefits",
];

const atsEndpoints = [
  "activities",
  "applications",
  "attachments",
  "departments",
  "candidates",
  "eeocs",
  "interviews",
  "issues",
  "job-interview-stages",
  "offices",
  "offers",
  "jobs",
  "scorecards",
  "reject-reasons",
  "job-postings",
  "tags",
  "users"
];

const fetchPaginatedData = async (endpoint, merge_access_token, modified_after) => {
  let results = [];
  let nextCursor = null;

  do {
    const url = new URL(`https://api.merge.dev/api/hris/v1/${endpoint}`);
    if (modified_after) url.searchParams.append("modified_after", modified_after);
    if (nextCursor) url.searchParams.append("cursor", nextCursor);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
        "X-Account-Token": merge_access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }

    const data = await response.json();
    results = results.concat(data.results);
    nextCursor = data.next || null;
  } while (nextCursor);

  return results;
};

const createEndpointHandler = (endpoint) => {
  return async (req, res) => {
    try {
      const { userId, modified_after } = req.query;
      if (!userId) return res.status(400).json({ message: "User ID is required" });

      // Retrieve account token from Db
      const result = await pool.query(
        "SELECT merge_access_token FROM user_tokens WHERE user_id = $1 AND integration_type = $2",
        [userId, 'hris'] 
      );
            if (result.rows.length === 0) return res.status(404).json({ message: "No account token found for user" });

      const merge_access_token = result.rows[0].merge_access_token;

      const data = await fetchPaginatedData(endpoint, merge_access_token, modified_after);

      res.json({ results: data });
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      res.status(500).json({ message: `Error fetching ${endpoint}` });
    }
  };
};

const fetchPaginatedAtsData = async (endpoint, merge_access_token, modified_after) => {
  let results = [];
  let nextCursor = null;

  do {
    const url = new URL(`https://api.merge.dev/api/ats/v1/${endpoint}`);
    if (modified_after) url.searchParams.append("modified_after", modified_after);
    if (nextCursor) url.searchParams.append("cursor", nextCursor);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
        "X-Account-Token": merge_access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }

    const data = await response.json();
    results = results.concat(data.results);
    nextCursor = data.next || null;
  } while (nextCursor);

  return results;
};

const createAtsEndpointHandler = (endpoint) => {
  return async (req, res) => {
    try {
      const { userId, modified_after } = req.query;
      if (!userId) return res.status(400).json({ message: "User ID is required" });

      const result = await pool.query(
        "SELECT merge_access_token FROM user_tokens WHERE user_id = $1 AND integration_type = $2",
        [userId, 'ats']
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "No ATS account token found for user" });

      const merge_access_token = result.rows[0].merge_access_token;
      const data = await fetchPaginatedAtsData(endpoint, merge_access_token, modified_after);

      res.json({ results: data });
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      res.status(500).json({ message: `Error fetching ${endpoint}` });
    }
  };
};

router.get("/", (req, res) => {
  res.send("hris apis.");
});

router.post("/:integrationType/generate-link-token", async (req, res) => {
  try {
    const { integrationType } = req.params; // 'hris' or 'ats'
    const { email, organization, userId } = req.body;
    
    console.log(email, organization, userId);


    const response = await fetch("https://api.merge.dev/api/integrations/create-link-token", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        end_user_email_address: email,
        end_user_organization_name: organization,
        end_user_origin_id: userId,
        categories: ["hris","ats" ],
      }),
    });

    const data = await response.json();
    console.log(data, data.link_token);
    res.json({ linkToken: data.link_token });
  } catch (error) {
    console.error("Error generating link token:", error);
    res.status(500).json({ message: "Error generating link token" });
  }
});



router.post("/:integrationType/retrieve-account-token", async (req, res) => {
  try {
    const { integrationType } = req.params;
    const { publicToken, userId, platformName } = req.body;

    const response = await fetch(`https://api.merge.dev/api/integrations/account-token/${publicToken}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
      },
    });

    const data = await response.json();
    const merge_access_token = data.account_token;
    if (!merge_access_token) throw new Error("Failed to retrieve account token");

    const result = await pool.query(
      `INSERT INTO user_tokens (user_id, integration_type, account_token, merge_access_token, refresh_token, platform_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, integration_type)
       DO UPDATE SET 
         account_token = EXCLUDED.account_token,
         merge_access_token = EXCLUDED.merge_access_token,
         refresh_token = EXCLUDED.refresh_token,
         platform_name = EXCLUDED.platform_name,
         last_used = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, integrationType, merge_access_token, merge_access_token, "dummy-refresh-token", platformName]
    );

    res.json({ merge_access_token });
  } catch (error) {
    console.error("Error retrieving account token:", error);
    res.status(500).json({ message: "Error retrieving account token" });
  }
});

router.get("/user/:userId/integration-status", async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT integration_type FROM user_tokens WHERE user_id = $1`,
      [userId]
    );

    const integrationStatus = { hris: false, ats: false };

    rows.forEach(row => {
      if (row.integration_type === 'hris') {
        integrationStatus.hris = true;
      } else if (row.integration_type === 'ats') {
        integrationStatus.ats = true;
      }
    });

    res.json(integrationStatus);
  } catch (error) {
    console.error("Error fetching integration status:", error);
    res.status(500).json({ message: "Error fetching integration status" });
  }
});


router.get("/test/employees", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const result = await pool.query(
      "SELECT merge_access_token FROM user_tokens WHERE user_id = $1 AND integration_type = $2",
      [userId, 'hris']
    );
    
    if (result.rows.length === 0) return res.status(404).json({ message: "No account token found for user" });
    const merge_access_token  = result.rows[0].merge_access_token;
    console.log(merge_access_token);

    const response = await fetch("https://api.merge.dev/api/hris/v1/employees", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
        "X-Account-Token": merge_access_token,
        "Content-Type": "application/json",
      },
    });
  
    if (!response.ok) {
      throw new Error(`Failed to fetch employees: ${response.statusText}`);
    }
  
    const employees = await response.json();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Error fetching employees" });
  }
});

  endpoints.forEach((endpoint) => {
    router.get(`/${endpoint}`, createEndpointHandler(endpoint));
  });

  router.get("/test/users", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ message: "User ID is required" });
  
      const result = await pool.query(
        "SELECT merge_access_token FROM user_tokens WHERE user_id = $1 AND integration_type = $2",
        [userId, 'ats']
      );
  
      if (result.rows.length === 0) return res.status(404).json({ message: "No ATS account token found for user" });
  
      const merge_access_token = result.rows[0].merge_access_token;
  
      const response = await fetch("https://api.merge.dev/api/ats/v1/candidates", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
          "X-Account-Token": merge_access_token,
          "Content-Type": "application/json",
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates: ${response.statusText}`);
      }
  
      const candidates = await response.json();
      res.json(candidates);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      res.status(500).json({ message: "Error fetching candidates" });
    }
  });
  

  router.get("/jobs/:jobId/screening-questions", async (req, res) => {
    try {
      const { userId } = req.query;
      const { jobId } = req.params;
      if (!userId || !jobId) return res.status(400).json({ message: "User ID and Job ID are required" });
  
      const result = await pool.query(
        "SELECT merge_access_token FROM user_tokens WHERE user_id = $1 AND integration_type = $2",
        [userId, 'ats']
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "No ATS account token found for user" });
  
      const merge_access_token = result.rows[0].merge_access_token;
  
      const url = `https://api.merge.dev/api/ats/v1/jobs/${jobId}/screening-questions`;
  
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.MERGE_API_KEY}`,
          "X-Account-Token": merge_access_token,
          "Content-Type": "application/json",
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch screening questions: ${response.statusText}`);
      }
  
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching screening questions:", error);
      res.status(500).json({ message: "Error fetching screening questions" });
    }
  });
  atsEndpoints.forEach((endpoint) => {
    router.get(`/ats/${endpoint}`, createAtsEndpointHandler(endpoint));
  });
    
export default router;
