import User from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";
import { sanitizeUser } from "./auth.controller.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signupMobile = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;
  const existUser = await User.findOne({ email });
  if (existUser) {
    throw new ApiError(409, "Email already in use.", {
      email: ["A user with this email already exists."],
    });
  }
  const newUser = await User.create({ email, password, fullName });

  const accessToken = generateAccessToken(newUser._id);
  const refreshToken = generateRefreshToken(newUser._id);
  newUser.refreshToken = refreshToken;
  await newUser.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { accessToken, refreshToken, user: sanitizeUser(newUser) },
        "Signup successful",
      ),
    );
});

export const loginMobile = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const existUser = await User.findOne({ email }).select("+password");
  if (!existUser) throw new ApiError(404, "Invalid Email or Password");

  const isMatch = await existUser.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Invalid Email or Password");

  const accessToken = generateAccessToken(existUser._id);
  const refreshToken = generateRefreshToken(existUser._id);
  existUser.refreshToken = refreshToken;
  await existUser.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken, user: sanitizeUser(existUser) },
        "Login successful",
      ),
    );
});

export const refreshAccessTokenMobile = asyncHandler(async (req, res) => {
  const { refreshToken: incomingToken } = req.body;
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
  return res
    .status(200)
    .json(new ApiResponse(200, { accessToken }, "Access token refreshed"));
});

export const logoutMobile = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});
