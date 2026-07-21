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
import {
  loginMobile,
  logoutMobile,
  refreshAccessTokenMobile,
  signupMobile,
} from "../controllers/auth.mobile.controller.js";

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

router.post(
  "/mobile/signup",
  authLimiter,
  validate(signupSchema),
  signupMobile,
);
router.post("/mobile/login", authLimiter, validate(loginSchema), loginMobile);
router.post("/mobile/refresh", refreshAccessTokenMobile);
router.post("/mobile/logout", protectedRoute, logoutMobile);

export default router;
