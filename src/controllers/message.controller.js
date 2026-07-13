import mongoose from "mongoose";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getIO, getReceiverSocketId } from "../sockets/index.js";

// ── SIDEBAR: chat list with last message, sorted by most recent activity ──
export const getUsersForSidebar = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user._id;

  const messages = await Message.find({
    $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
  })
    .sort({ createdAt: -1 })
    .populate("senderId", "fullName profilePic")
    .populate("receiverId", "fullName profilePic");

  // Mujhe bheje gaye messages jo abhi tak "sent" hain, unhe "delivered" mark karo
  // (kyunki main abhi online hoon aur API hit kar raha hoon)
  const undelivered = messages.filter(
    (msg) => msg.receiverId._id.equals(loggedInUserId) && msg.status === "sent",
  );

  if (undelivered.length > 0) {
    const undeliveredIds = undelivered.map((msg) => msg._id);
    await Message.updateMany(
      { _id: { $in: undeliveredIds } },
      { $set: { status: "delivered" } },
    );

    // Har sender ko batao unka message deliver ho gaya
    const io = getIO();
    undelivered.forEach((msg) => {
      const senderSocketId = getReceiverSocketId(msg.senderId._id.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageStatusUpdate", {
          messageId: msg._id,
          status: "delivered",
        });
      }
    });
  }

  // Conversation list banao — ek entry per unique user, sorted by last message time
  const chatMap = new Map();
  messages.forEach((msg) => {
    const otherUser = msg.senderId._id.equals(loggedInUserId)
      ? msg.receiverId
      : msg.senderId;
    const key = otherUser._id.toString();

    // messages already createdAt desc sorted hain, isliye pehli entry hi latest hai
    if (!chatMap.has(key)) {
      chatMap.set(key, { user: otherUser, lastMessage: msg, unreadCount: 0 });
    }

    // Unread count: mujhe bheja gaya aur abhi "seen" nahi hua
    const isUnseenIncoming =
      msg.receiverId._id.equals(loggedInUserId) && msg.status !== "seen";
    if (isUnseenIncoming) {
      chatMap.get(key).unreadCount += 1;
    }
  });

  // Map insertion order already latest-first hai (kyunki messages desc sorted the)
  const chatList = Array.from(chatMap.values());

  return res.status(200).json(new ApiResponse(200, { chats: chatList }));
});

// ── Conversation ke saare messages, aur unhe "seen" mark karo ──
export const getMessages = asyncHandler(async (req, res) => {
  const { id: otherUserId } = req.params;
  const myId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const messages = await Message.find({
    $or: [
      { senderId: myId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: myId },
    ],
  }).sort({ createdAt: 1 });

  // Dusre user ne mujhe jo bhi messages bheje the aur abhi "seen" nahi the, unhe seen karo
  const unseenIds = messages
    .filter(
      (msg) =>
        msg.receiverId.toString() === myId.toString() && msg.status !== "seen",
    )
    .map((msg) => msg._id);

  if (unseenIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unseenIds } },
      { $set: { status: "seen" } },
    );

    const io = getIO();
    const senderSocketId = getReceiverSocketId(otherUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", {
        seenBy: myId,
        messageIds: unseenIds,
      });
    }
  }

  return res.status(200).json(new ApiResponse(200, { messages }));
});

// ── Naya message bhejo ──
export const sendMessage = asyncHandler(async (req, res) => {
  const { text, image } = req.body;
  const { id: receiverId } = req.params;
  const senderId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    throw new ApiError(400, "Invalid receiver id");
  }
  if (receiverId === senderId.toString()) {
    throw new ApiError(400, "Cannot send a message to yourself");
  }

  const receiver = await User.findById(receiverId).select(
    "fullName profilePic",
  );
  if (!receiver) throw new ApiError(404, "Receiver not found");

  let imageUrl;
  if (image) {
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "chat-app/messages",
    });
    imageUrl = uploadResponse.secure_url;
  }

  // Receiver abhi online hai toh seedha "delivered" set kar do
  const receiverSocketId = getReceiverSocketId(receiverId);

  const newMessage = await Message.create({
    senderId,
    receiverId,
    text,
    image: imageUrl,
    status: receiverSocketId ? "delivered" : "sent",
  });

  const io = getIO();
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", {
      message: newMessage,
      sender: {
        _id: req.user._id,
        fullName: req.user.fullName,
        profilePic: req.user.profilePic,
      },
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, { message: newMessage, receiver }, "Message sent"),
    );
});
