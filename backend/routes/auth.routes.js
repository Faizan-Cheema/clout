// routes/auth.routes.js
import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { authenticateToken, requireFreshAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", AuthController.signup);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);

router.get("/validate-token", authenticateToken, AuthController.validateToken);
router.post("/logout", authenticateToken, AuthController.logout);
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", requireFreshAuth, (req, res) => {
  res.json({ message: "Password change endpoint - requires fresh auth" });
});

export default router;
