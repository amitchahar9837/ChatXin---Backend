import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import User from "../models/user.model.js";

export const protectedRoute = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new ApiError(401, "Unauthorized — no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new ApiError(401, "Unauthorized — invalid or expired token");
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new ApiError(404, "User belonging to this token no longer exists");
  }

  req.user = user;
  next();
});
