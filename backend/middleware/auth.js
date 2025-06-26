import pool from "../config/db.js";
import TokenService from "../services/token.service.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    // Verify the token
    const decoded = TokenService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    const storedTokens = await TokenService.findTokens(decoded.userId);

    if (!storedTokens || storedTokens.account_token !== token) {
      return res.status(403).json({
        error: "Token has been revoked.",
        code: "TOKEN_REVOKED",
      });
    }

    if (TokenService.isTokenExpired(token)) {
      return res.status(401).json({
        error: "Token has expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    await pool.query(
      "UPDATE user_tokens SET last_used = NOW() WHERE user_id = $1",
      [decoded.userId]
    );

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Invalid token." });
  }
};

export const requireFreshAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = TokenService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(403).json({ error: "Invalid token." });
    }

    const tokenData = await TokenService.findTokens(decoded.userId);
    const createdAt = new Date(tokenData.created_at);
    const now = new Date();
    const tokenAgeMinutes = (now - createdAt) / (1000 * 60);

    if (tokenAgeMinutes > 15) {
      return res.status(401).json({
        error: "Fresh authentication required for this operation.",
        code: "FRESH_AUTH_REQUIRED",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Fresh auth verification error:", error);
    return res.status(403).json({ error: "Authentication error." });
  }
};
