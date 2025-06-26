import { S3 } from "@aws-sdk/client-s3";

import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3({
  forcePathStyle: false,
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: "sgp1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  }
});
export default s3Client;
