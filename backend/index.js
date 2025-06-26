import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mergeRoutes from "./routes/merge.routes.js";
import authRoutes from "./routes/auth.routes.js";
import datasetRoutes from "./routes/datasets.routes.js";
import linkedDatasetsRoutes from "./routes/linkedDatasets.routes.js";
import linkedDatasetsMetricsRoutes from "./routes/linkedDatasetsMetrics.routes.js"
import chatRoutes from "./routes/chat.routes.js";
import reportRoutes from "./routes/report.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

import createUsersTable from "./models/usersModel.js";
import createUserTokensTable from "./models/userTokensModel.js";
import createDatasetsTable from "./models/datasetsModal.js";
import createLinkedDatasetsTable from "./models/linkedDatasetsModal.js";
import createLinkedDatasetsMetricsTable from "./models/linkedDatasetMetricsModal.js";
import createChatsTable from "./models/chatsModal.js";
import createChatMessagesTable from "./models/chatMessagesModal.js";
import createReportsTable from "./models/reportsModal.js";
import createSubscriptionsTable from "./models/subscriptionsModal.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));



const initializeDatabase = async () => {
  await createUsersTable();
  await createUserTokensTable();
  await createDatasetsTable();
  await createLinkedDatasetsTable();
  await createLinkedDatasetsMetricsTable();
  await createChatsTable();
  await createChatMessagesTable();
  await createReportsTable();
  await createSubscriptionsTable();
  
};
initializeDatabase();

// Routes
app.get("/", (req, res) => {
  res.send("hey from the server.");
});
app.use("/api/auth", authRoutes);
app.use("/api/merge", mergeRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/linked-datasets", linkedDatasetsRoutes);
app.use("/api/metrics", linkedDatasetsMetricsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/subscriptions", subscriptionRoutes);





app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
