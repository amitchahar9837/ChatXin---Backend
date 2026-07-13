import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./sockets/index.js";
import { env } from "./config/env.js";

const httpServer = http.createServer(app);
initSocket(httpServer);

const startServer = async () => {
  await connectDB();
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

startServer();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  httpServer.close(() => process.exit(1));
});
