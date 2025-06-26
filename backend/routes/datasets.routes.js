import express from 'express';
import pool from "../config/db.js";
import s3Client from "../services/s3Service.js"
import { Upload } from "@aws-sdk/lib-storage";
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import { parse } from 'json2csv';
import dotenv from 'dotenv';
import  multer from 'multer';
import xlsx from 'xlsx';


dotenv.config();

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper functions


const uploadCSVToSpaces = async (csvData, fileName, contentType) => {
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
    Body: csvData,
    ACL: 'public-read',
    ContentType: contentType,
  };

  const upload = new Upload({
    client: s3Client,
    params: params,
  });

  const data = await upload.done();
  return `${process.env.DO_SPACES_ENDPOINT}/${process.env.DO_SPACES_BUCKET}/${fileName}`;
};


const saveMetadataToPostgres = async (userId, endpoint, fileKey, fileUrl, rowCount) => {
  const query = `
    INSERT INTO datasets (user_id, endpoint, file_key, file_url, row_count)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `;
  const values = [userId, endpoint, fileKey, fileUrl, rowCount];
  const res = await pool.query(query, values);
  return res.rows[0].id;
};




router.post('/save-datasets', upload.array('files'), async (req, res) => {
  const { userId, csvFileName } = req.body;
  const files = req.files;
  const datasets = req.body.datasets ? JSON.parse(req.body.datasets) : null;

  if (!userId || ((!files || files.length === 0) && !datasets)) {
    return res.status(400).json({ error: 'User ID and dataset file or data are required.' });
  }

  try {
    const results = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const datasetName = file.originalname.split('.')[0];

        if (file.mimetype === 'text/csv') {
          const csvData = file.buffer.toString('utf-8');
          const rowCount = csvData.split('\n').length - 1;

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileKey = `${userId}/${datasetName}-${timestamp}.csv`;

          const fileUrl = await uploadCSVToSpaces(csvData, fileKey, 'text/csv');
          const datasetId = await saveMetadataToPostgres(
            userId,
            datasetName,
            fileKey,
            fileUrl,
            rowCount
          );

          results.push({ datasetName, fileUrl, datasetId });

        } else if (
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          const workbook = xlsx.read(file.buffer, { type: 'buffer' });

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet, {
              raw: false,      
            });
            
            if (jsonData.length === 0) continue; // skip empty sheets

            const csvData = parse(jsonData); // Convert sheet in j son to CSV
            const rowCount = jsonData.length;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sheetDatasetName = `${datasetName}-${sheetName}`;
            const fileKey = `${userId}/${sheetDatasetName}-${timestamp}.csv`;

            const fileUrl = await uploadCSVToSpaces(csvData, fileKey, 'text/csv');
            const datasetId = await saveMetadataToPostgres(
              userId,
              sheetDatasetName,
              fileKey,
              fileUrl,
              rowCount
            );

            results.push({ datasetName: sheetDatasetName, fileUrl, datasetId, sheetName });
          }
        } else {
          continue; 
        }
      }
    }

    if (datasets) {
      for (const [key, data] of Object.entries(datasets)) {
        if (!Array.isArray(data) || data.length === 0) {
          continue;
        }
        const datasetName = csvFileName || key;
        const csvData = parse(data);

        const rowCount = data.length;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileKey = `${userId}/${datasetName}-${timestamp}.csv`;

        const fileUrl = await uploadCSVToSpaces(csvData, fileKey);
        const datasetId = await saveMetadataToPostgres(
          userId,
          datasetName,
          fileKey,
          fileUrl,
          rowCount
        );

        results.push({ datasetName, fileUrl, datasetId });
      }
    }

    const sheetNames = results.map(r => r.datasetName);

    res.status(200).json({
      message: 'Datasets saved successfully.',
      results,
      sheetNames
    });
  } catch (error) {
    console.error('Error saving datasets:', error);
    res.status(500).json({ error: 'An error occurred while saving datasets.' });
  }
});


router.delete('/delete-dataset', async (req, res) => {
  const { userId, datasetId } = req.body;

  if (!userId || !datasetId) {
    return res.status(400).json({ error: 'User ID and Dataset ID are required.' });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT file_key FROM datasets WHERE id = $1 AND user_id = $2',
      [datasetId, userId]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    const { file_key } = result.rows[0];

    // to delete from  Spaces and then metadata too
    const deleteParams = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: file_key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));

    await client.query('DELETE FROM datasets WHERE id = $1 AND user_id = $2', [
      datasetId,
      userId,
    ]);

    client.release();

    res.status(200).json({ message: 'Dataset deleted successfully.' });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({ error: 'An error occurred while deleting the dataset.' });
  }
});


router.put('/update-dataset', upload.single('file'), async (req, res) => {
  const { userId, datasetId, endpoint } = req.body;
  const file = req.file; 

  if (!userId || !datasetId) {
    return res.status(400).json({ error: 'User ID and Dataset ID are required.' });
  }

  try {
    const client = await pool.connect();

    const result = await client.query(
      'SELECT file_key FROM datasets WHERE id = $1 AND user_id = $2',
      [datasetId, userId]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    let { file_key: oldFileKey } = result.rows[0];
    let newFileKey = oldFileKey;
    let newFileUrl = null;
    let newRowCount = null;

    if (file) {
      // Delete old from Spaces
      const deleteParams = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: oldFileKey,
      };
      await s3Client.send(new DeleteObjectCommand(deleteParams));


      const datasetName = endpoint || file.originalname.split('.')[0];
      let csvData;
      let contentType = 'text/csv';
      let extension = 'csv';

      if (file.mimetype === 'text/csv') {
        csvData = file.buffer.toString('utf-8');
        newRowCount = csvData.split('\n').length - 1;
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel'
      ) {
        extension = 'xlsx';
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        newRowCount = workbook.Sheets[workbook.SheetNames[0]]
          ? xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).length
          : 0;
        csvData = file.buffer;
      } else {
        client.release();
        return res.status(400).json({ error: 'Unsupported file type.' });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      newFileKey = `${userId}/${datasetName}-${timestamp}.${extension}`;

      newFileUrl = await uploadCSVToSpaces(csvData, newFileKey, contentType);
    }

    let updateFields = [];
    let updateValues = [];
    let idx = 1;

    if (endpoint) {
      updateFields.push(`endpoint = $${idx++}`);
      updateValues.push(endpoint);
    }
    if (file) {
      updateFields.push(`file_key = $${idx++}`);
      updateValues.push(newFileKey);

      updateFields.push(`file_url = $${idx++}`);
      updateValues.push(newFileUrl);

      updateFields.push(`row_count = $${idx++}`);
      updateValues.push(newRowCount);
    }

    if (updateFields.length > 0) {
      updateValues.push(datasetId, userId);
      const query = `
        UPDATE datasets
        SET ${updateFields.join(', ')}
        WHERE id = $${idx++} AND user_id = $${idx}
        RETURNING *;
      `;

      const updateResult = await client.query(query, updateValues);
      client.release();

      return res.status(200).json({
        message: 'Dataset updated successfully.',
        dataset: updateResult.rows[0],
      });
    } else {
      client.release();
      return res.status(400).json({ error: 'No new data provided to update.' });
    }
  } catch (error) {
    console.error('Error updating dataset:', error);
    return res.status(500).json({ error: 'Error updating dataset.' });
  }
});




router.get('/get-datasets/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT id, endpoint, file_key, file_url, row_count, created_at
      FROM datasets
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const values = [userId];
    const result = await pool.query(query, values);

    res.status(200).json({ datasets: result.rows });
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({ error: 'Error fetching datasets.' });
  }
});


export default router;
