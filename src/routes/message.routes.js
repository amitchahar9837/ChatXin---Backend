import express from "express";
import {
  getUsersForSidebar,
  getMessages,
  sendMessage,
} from "../controllers/message.controller.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { sendMessageSchema } from "../validators/message.validator.js";

const router = express.Router();

router.use(protectedRoute);

router.get("/users", getUsersForSidebar);
router.get("/:id", getMessages);
router.post("/send/:id", validate(sendMessageSchema), sendMessage);

export default router;
