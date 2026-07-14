import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import cloudinary from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  setAuthCookies,
  clearAuthCookies,
  generateAccessToken,
} from "../utils/generateTokens.js";
import { env } from "../config/env.js";

const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export const signup = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;
  const existUser = await User.findOne({ email });
  if (existUser) {
    throw new ApiError(409, "Email already in use.", {
      email: ["A user with this email already exists."],
    });
  }
  const newUser = await User.create({ email, password, fullName });

  const { refreshToken } = setAuthCookies(res, newUser._id);
  newUser.refreshToken = refreshToken;
  await newUser.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: sanitizeUser(newUser) },
        "Signup successful",
      ),
    );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password field select:false hai model mein, isliye explicitly select karo
  const existUser = await User.findOne({ email }).select("+password");
  if (!existUser)
    throw new ApiError(
      404,
      `${env.NODE_ENV === "development" ? "User not found." : "Invalid Email or Password"}`,
    );

  const isMatch = await existUser.comparePassword(password);
  if (!isMatch)
    throw new ApiError(
      401,
      `${env.NODE_ENV === "development" ? "Wrong credentials." : "Invalid Email or Password"}`,
    );

  const { refreshToken } = setAuthCookies(res, existUser._id);
  console.log(refreshToken);
  existUser.refreshToken = refreshToken;
  await existUser.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: sanitizeUser(existUser) },
        "Login successful",
      ),
    );
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  clearAuthCookies(res);
  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

// Access token expire hone pe frontend yahan hit karega refresh token cookie ke sath
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;
  if (!incomingToken) throw new ApiError(401, "Refresh token missing");

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.userId).select("+refreshToken");
  if (!user || user.refreshToken !== incomingToken) {
    throw new ApiError(401, "Refresh token mismatch — please login again");
  }

  const accessToken = generateAccessToken(user._id);
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 15 * 60 * 1000,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Access token refreshed"));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { profilePic, fullName, bio } = req.body;
  const userId = req.user._id;

  const updates = {};
  if (fullName) updates.fullName = fullName;
  if (bio) updates.bio = bio;

  if (profilePic) {
    const uploadResponse = await cloudinary.uploader.upload(profilePic, {
      folder: "chatxin/profiles",
    });
    updates.profilePic = uploadResponse.secure_url;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "Nothing to update", {
      body: ["Provide at least one of fullName, bio, profilePic"],
    });
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: sanitizeUser(updatedUser) },
        "Profile updated",
      ),
    );
});

export const checkAuth = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { user: sanitizeUser(req.user) }, "OK"));
});
