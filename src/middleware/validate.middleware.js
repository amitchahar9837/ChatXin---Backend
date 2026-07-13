import { ApiError } from "../utils/ApiError.js";

export const validate = (schema) => (req, res, next) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Object.keys(req.body).length === 0
  ) {
    return next(
      new ApiError(400, "Request body is missing or empty", {
        body: ["Send JSON body with 'Content-Type: application/json' header."],
      }),
    );
  }

  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] ?? "body";
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    });
    return next(new ApiError(400, "Validation error", errors));
  }

  req.body = result.data;
  next();
};
