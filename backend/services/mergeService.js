import { MergeClient } from '@mergeapi/merge-node-client';
import dotenv from 'dotenv';

dotenv.config();

const merge = new MergeClient({
  apiKey: process.env.MERGE_API_KEY || "cMlrjcXMzLfTD58sZGNaLCcJkebBFijUGoZmMDNmdI0-eRUTwRS65A",
});

export default merge;
