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

  // 👇 Aggregation se seedha "per-conversation latest message + unread count" nikalte hain
  // Poori message history load nahi karni padti — ye sabse bada speed fix hai
  const chats = await Message.aggregate([
    {
      $match: {
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$senderId", loggedInUserId] },
            "$receiverId",
            "$senderId",
          ],
        },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiverId", loggedInUserId] },
                  { $ne: ["$status", "seen"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]);

  // Otherwise chats me sirf otherUserId hai, unke fullName/profilePic ek hi query me le lo
  const otherUserIds = chats.map((c) => c._id);
  const users = await User.find({ _id: { $in: otherUserIds } })
    .select("fullName profilePic")
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const chatList = chats
    .map((c) => {
      const user = userMap.get(c._id.toString());
      if (!user) return null; // deleted user safety check
      return {
        user,
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount,
      };
    })
    .filter(Boolean);

  // Mujhe bheje gaye "sent" status wale messages ko "delivered" mark karo
  // (lightweight query — sirf _id aur senderId chahiye, poora document nahi)
  const undelivered = await Message.find({
    receiverId: loggedInUserId,
    status: "sent",
  })
    .select("_id senderId")
    .lean();

  if (undelivered.length > 0) {
    const undeliveredIds = undelivered.map((msg) => msg._id);
    await Message.updateMany(
      { _id: { $in: undeliveredIds } },
      { $set: { status: "delivered" } },
    );

    const io = getIO();
    undelivered.forEach((msg) => {
      const senderSocketId = getReceiverSocketId(msg.senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageStatusUpdate", {
          messageId: msg._id,
          status: "delivered",
        });
      }
    });
  }

  return res.status(200).json(new ApiResponse(200, { chats: chatList }));
});

// ── Conversation ke messages, cursor-based pagination ke saath ──
export const getMessages = asyncHandler(async (req, res) => {
  const { id: otherUserId } = req.params;
  const myId = req.user._id;
  const { before, limit = 30 } = req.query; // 👈 pagination params

  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const query = {
    $or: [
      { senderId: myId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: myId },
    ],
  };

  // "before" diya hai to sirf usse purane messages lao (infinite scroll pagination)
  if (before && mongoose.Types.ObjectId.isValid(before)) {
    query._id = { $lt: new mongoose.Types.ObjectId(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 }) // latest pehle nikalte hain
    .limit(Number(limit))
    .lean();

  const orderedMessages = messages.reverse(); // UI ke liye oldest-to-newest order

  // Dusre user ne mujhe jo bhi messages bheje the aur "seen" nahi the, unhe seen karo
  const unseenIds = orderedMessages
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

  const hasMore = messages.length === Number(limit);

  return res
    .status(200)
    .json(new ApiResponse(200, { messages: orderedMessages, hasMore }));
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

  const receiver = await User.findById(receiverId)
    .select("fullName profilePic")
    .lean();
  if (!receiver) throw new ApiError(404, "Receiver not found");

  let imageUrl;
  if (image) {
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "chat-app/messages",
    });
    imageUrl = uploadResponse.secure_url;
  }

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
