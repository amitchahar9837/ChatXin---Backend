import mongoose from "mongoose";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const searchEverything = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const query = req.query.q?.trim();

  if (!query) throw new ApiError(400, "Query param 'q' is required");

  // Escape regex special chars taaki user "a.b*c" jaisa input crash na kare
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const allMessages = await Message.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });

  const chatUserIds = new Set();
  const chatMap = new Map();

  allMessages.forEach((msg) => {
    const otherUserId =
      msg.senderId.toString() === userId.toString()
        ? msg.receiverId.toString()
        : msg.senderId.toString();

    chatUserIds.add(otherUserId);

    // messages already createdAt desc sorted hain, pehli entry hi latest hai
    if (!chatMap.has(otherUserId)) {
      chatMap.set(otherUserId, { userId: otherUserId, lastMessage: msg });
    }
  });

  const excludedUserIds = [...chatUserIds, userId.toString()].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  // 1️⃣ Chat-history users jinka naam match karta hai
  const chatUsers = await User.find({
    _id: { $in: [...chatUserIds] },
    fullName: { $regex: safeQuery, $options: "i" },
  }).select("_id fullName profilePic");

  const fullChatList = chatUsers
    .map((user) => {
      const entry = chatMap.get(user._id.toString());
      if (!entry) return null;
      return {
        user,
        lastMessage: entry.lastMessage,
        updatedAt: entry.lastMessage.updatedAt, // fixed: pehle ye undefined tha
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 2️⃣ Naye users jinse kabhi baat nahi hui
  const otherUsers = await User.find({
    _id: { $nin: excludedUserIds },
    fullName: { $regex: safeQuery, $options: "i" },
  }).select("_id fullName profilePic bio");

  // 3️⃣ Messages jinke text mein query match karta hai
  const messagesWithMatch = await Message.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
    text: { $regex: safeQuery, $options: "i" },
  })
    .sort({ createdAt: -1 })
    .populate("senderId receiverId", "fullName profilePic");

  const seenUsers = new Set();
  const messageResults = [];

  for (const msg of messagesWithMatch) {
    const otherUser =
      msg.senderId._id.toString() === userId.toString()
        ? msg.receiverId
        : msg.senderId;
    const otherUserId = otherUser._id.toString();

    if (!seenUsers.has(otherUserId)) {
      seenUsers.add(otherUserId);
      messageResults.push({
        user: {
          _id: otherUser._id,
          fullName: otherUser.fullName,
          profilePic: otherUser.profilePic,
        },
        matchedMessage: msg.text,
        messageId: msg._id,
      });
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {
      chatUsers: fullChatList,
      allUsers: otherUsers,
      fromMessages: messageResults,
    })
  );
});
