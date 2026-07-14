import express from "express";

const router = express.Router();
router.get("/turn-credentials", getTurnCredentials);
export default router;
