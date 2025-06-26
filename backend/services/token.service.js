import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { v4 as uuidv4 } from "uuid";

class TokenService {
  static generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "24h",
    });
  }

  static generateRefreshToken(payload) {
    return jwt.sign(
      { ...payload, tokenId: uuidv4() },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
    );
  }

  static async generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      organization: user.organization,
    };
  
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
  
    await this.storeTokens(user.id, accessToken, refreshToken, "default");
  
    return {
      accessToken,
      refreshToken,
    };
  }
  

  // Store both tokens in database
  static async storeTokens(userId, accessToken, refreshToken, integrationType = "default") {
    const query = `
      INSERT INTO user_tokens (user_id, integration_type, account_token, refresh_token, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, integration_type) 
      DO UPDATE SET 
        account_token = $3, 
        refresh_token = $4,
        created_at = NOW()
    `;
    await pool.query(query, [userId, integrationType, accessToken, refreshToken]);
  }
  

  // Validate access token
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Validate refresh token
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
      );
    } catch (error) {
      return null;
    }
  }

  // Check if token exists in database (to prevent use of revoked tokens)
  static async findTokens(userId) {
    const query = `
      SELECT 
        account_token, 
        refresh_token, 
        created_at 
      FROM user_tokens 
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  // Revoke user tokens (for logout)
  static async revokeTokens(userId) {
    const query = "DELETE FROM user_tokens WHERE user_id = $1";
    await pool.query(query, [userId]);
  }

  // Refresh access token using refresh token
  static async refreshAccessToken(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);

    if (!decoded) {
      throw new Error("Invalid refresh token");
    }

    // Check if refresh token exists in database
    const storedTokens = await this.findTokens(decoded.userId);

    if (!storedTokens || storedTokens.refresh_token !== refreshToken) {
      throw new Error("Refresh token has been revoked");
    }

    // Generate new access token with the same payload
    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      organization: decoded.organization,
    };

    const newAccessToken = this.generateAccessToken(payload);

    await this.updateAccessToken(decoded.userId, newAccessToken, "default");

    return newAccessToken;
  }
  static async updateAccessToken(userId, accessToken, integrationType = "default") {
    const query = `
      UPDATE user_tokens 
      SET account_token = $3, created_at = NOW()
      WHERE user_id = $1 AND integration_type = $2
    `;
    await pool.query(query, [userId, integrationType, accessToken]);
  }
  
  // Check if token is expired
  static isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token);
      const currentTime = Math.floor(Date.now() / 1000);

      // If token expiration time is less than current time, token is expired
      return decoded.exp < currentTime;
    } catch (error) {
      return true; // If there's an error decoding, consider it expired
    }
  }
}

export default TokenService;
