import { Server } from "socket.io";
import { env } from "../config/env.js";

let io;
const userSocketMap = new Map(); // userId -> socketId

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap.set(userId, socket.id);

    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

    socket.on("typing", ({ receiverId, senderId }) => {
      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit("userTyping", { senderId });
    });

    socket.on("stopTyping", ({ receiverId, senderId }) => {
      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit("userStopTyping", { senderId });
    });

    socket.on("disconnect", () => {
      if (userId) userSocketMap.delete(userId);
      io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });
  });

  return io;
};

export const getReceiverSocketId = (receiverId) => userSocketMap.get(receiverId);
export const getIO = () => io;
