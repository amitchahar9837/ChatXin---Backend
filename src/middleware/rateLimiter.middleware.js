import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res, next) => {
    res.status(429).json({
      success: false,
      message: "Too many attempts, try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler: (req, res, next) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, slow down.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
