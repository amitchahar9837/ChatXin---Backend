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
      if (receiverSocketId)
        io.to(receiverSocketId).emit("userTyping", { senderId });
    });

    socket.on("stopTyping", ({ receiverId, senderId }) => {
      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId)
        io.to(receiverSocketId).emit("userStopTyping", { senderId });
    });

    socket.on("disconnect", () => {
      if (userId) userSocketMap.delete(userId);
      io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });

    // ----------video call signaling events ----------------
    socket.on("call-user", ({ toUserId, offer, fromUserId, callerInfo }) => {
      console.log("Backend: call-user from", fromUserId, "to", toUserId);
      const targetSocketId = getReceiverSocketId(toUserId); // ✅ fixed
      console.log("Target socket id:", targetSocketId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("incoming-call", {
          fromUserId,
          offer,
          callerInfo,
        });
      } else {
        console.log("⚠️ Target user not found in socket map");
      }
    });

    socket.on("answer-call", ({ toUserId, answer }) => {
      const receiverSocketId = getReceiverSocketId(toUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call-accepted", { answer });
      }
    });

    // ICE candidates exchange (connection establish karne ke liye zaroori)
    socket.on("ice-candidate", ({ toUserId, candidate }) => {
      const receiverSocketId = getReceiverSocketId(toUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("ice-candidate", { candidate });
      }
    });

    socket.on("end-call", ({ toUserId }) => {
      const receiverSocketId = getReceiverSocketId(toUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call-ended");
      }
    });

    socket.on("reject-call", ({ toUserId }) => {
      const receiverSocketId = getReceiverSocketId(toUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call-rejected");
      }
    });
  });

  return io;
};

export const getReceiverSocketId = (receiverId) =>
  userSocketMap.get(receiverId);
export const getIO = () => io;
