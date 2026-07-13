import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // Agar ApiError nahi hai (Mongoose, JWT, ya koi generic error), toh normalize karo
  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal Server Error";
    let errors = {};

    // Mongoose duplicate key error
    if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      message = "Duplicate value error";
      errors[field] = [`This ${field} is already in use.`];
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      statusCode = 400;
      message = "Validation error";
      Object.keys(error.errors).forEach((key) => {
        errors[key] = [error.errors[key].message];
      });
    }

    // JWT errors
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      statusCode = 401;
      message = "Invalid or expired token";
    }

    error = new ApiError(statusCode, message, errors);
  }

  const response = {
    success: false,
    message: error.message,
    errors: error.errors,
  };

  if (env.NODE_ENV === "development") {
    response.stack = error.stack;
  }

  return res.status(error.statusCode).json(response);
};

// 404 handler — koi route match na ho toh
export const notFoundMiddleware = (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
};
