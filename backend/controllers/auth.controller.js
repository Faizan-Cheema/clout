import User from "../models/User.js";
import TokenService from "../services/token.service.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

class AuthController {
  static async signup(req, res) {
    try {
      const { firstName, lastName, email, password, organization } = req.body;

      if (!firstName || !lastName || !email || !password || !organization) {
        return res.status(400).json({
          error: "Missing required fields",
          details: {
            firstName: !firstName ? "First name is required" : null,
            lastName: !lastName ? "Last name is required" : null,
            email: !email ? "Email is required" : null,
            password: !password ? "Password is required" : null,
            organization: !organization ? "Organization is required" : null,
          },
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: "Invalid email format",
          details: "Please enter a valid email address",
        });
      }

      // Password strength validation
      if (password.length < 8) {
        return res.status(400).json({
          error: "Weak password",
          details: "Password must be at least 8 characters long",
        });
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: "Account already exists",
          details: "This email is already registered",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const user = await User.create({
        id: uuidv4(),
        firstName,
        lastName,
        email,
        password: hashedPassword,
        organization,
      });

      // Generate tokens
      const tokens = await TokenService.generateTokens(user);

      res.status(201).json({
        message: "User created successfully",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          organization: user.organization,
        },
      });
    } catch (error) {
      console.error("Signup error:", error);

      // Database-specific error handling
      if (error.code === "23505") {
        // PostgreSQL unique violation
        return res.status(409).json({
          error: "Database conflict",
          details: "This email is already registered",
        });
      }

      res.status(500).json({
        error: "Internal server error",
        details:
          "An unexpected error occurred during signup. Please try again later.",
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email || !password) {
        return res.status(400).json({
          error: "Missing credentials",
          details: {
            email: !email ? "Email is required" : null,
            password: !password ? "Password is required" : null,
          },
        });
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: "Authentication failed",
          details: "Invalid email or password",
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          error: "Authentication failed",
          details: "Invalid email or password",
        });
      }

      // Generate tokens
      const tokens = await TokenService.generateTokens(user);

      res.json({
        message: "Login successful",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          organization: user.organization,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Internal server error",
        details:
          "An unexpected error occurred during login. Please try again later.",
      });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: "Missing refresh token",
          details: "Refresh token is required",
        });
      }

      // Get new access token using the refresh token
      const newAccessToken = await TokenService.refreshAccessToken(
        refreshToken
      );

      res.json({
        message: "Token refreshed successfully",
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error("Token refresh error:", error);

      if (
        error.message === "Invalid refresh token" ||
        error.message === "Refresh token has been revoked"
      ) {
        return res.status(401).json({
          error: "Invalid refresh token",
          details: "Please log in again",
        });
      }

      res.status(500).json({
        error: "Internal server error",
        details: "An unexpected error occurred. Please try again later.",
      });
    }
  }

  static async logout(req, res) {
    try {
      // get user id from the authenticated request
      const userId = req.user.userId;

      // revoke all tokens for the user
      await TokenService.revokeTokens(userId);

      res.json({
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: "An unexpected error occurred during logout.",
      });
    }
  }

  static async validateToken(req, res) {
    return res.json({
      valid: true,
      user: req.user,
    });
  }
}

export default AuthController;
