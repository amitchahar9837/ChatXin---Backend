import express from "express";
import {
  checkAuth,
  login,
  logout,
  refreshAccessToken,
  signup,
  updateProfile,
} from "../controllers/auth.controller.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { authLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from "../validators/auth.validator.js";

const router = express.Router();

router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", protectedRoute, logout);
router.post("/refresh", refreshAccessToken);
router.put(
  "/update-profile",
  protectedRoute,
  validate(updateProfileSchema),
  updateProfile,
);
router.get("/check", protectedRoute, checkAuth);

export default router;
