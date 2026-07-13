import express from "express";
import { searchEverything } from "../controllers/search.controller.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectedRoute, searchEverything);

export default router;
