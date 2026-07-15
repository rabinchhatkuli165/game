const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/email");
const { randomToken } = require("../utils/tokens");
const {
  parseEmail,
  parseUsername,
  parsePassword,
  parseGameKey,
  parseFiniteNumber,
  assertObjectId,
  parseOpaqueToken
} = require("../utils/validation");

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    gameStats: user.gameStats
  };
}

function createToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function skipEmailVerification() {
  return process.env.SKIP_EMAIL_VERIFICATION === "true" || !smtpConfigured();
}

router.post("/signup", async (req, res) => {
  try {
    const username = parseUsername(req.body?.username);
    const email = parseEmail(req.body?.email);
    const password = parsePassword(req.body?.password);
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Invalid signup payload" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = randomToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      emailVerified: skipEmailVerification(),
      emailVerificationToken: skipEmailVerification() ? undefined : verifyToken,
      emailVerificationExpires: skipEmailVerification() ? undefined : verifyExpires
    });

    if (!skipEmailVerification()) {
      await sendVerificationEmail(email, verifyToken);
      return res.status(201).json({
        needsVerification: true,
        email: user.email,
        message: "Check your email to verify your account."
      });
    }

    const token = createToken(user);
    return res.status(201).json({
      token,
      user: publicUser(user),
      needsVerification: false
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = parseEmail(req.body?.email);
    const password = parsePassword(req.body?.password);
    if (!email || !password) {
      return res.status(400).json({ message: "Invalid login payload" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before signing in.",
        email: user.email
      });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
});

/** Confirm email using token from the verification link (body: { token }). */
router.post("/verify-email", async (req, res) => {
  try {
    const token = parseOpaqueToken(req.body?.token);
    if (!token) {
      return res.status(400).json({ message: "Invalid or missing token" });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const jwtToken = createToken(user);
    return res.json({
      message: "Email verified",
      token: jwtToken,
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Verification failed" });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const email = parseEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: "Valid email required" });
    }

    const user = await User.findOne({ email });
    // Same response whether or not user exists (avoid email enumeration).
    const generic = { message: "If an account exists for that email, a verification message was sent." };

    if (!user || user.emailVerified) {
      return res.json(generic);
    }

    const verifyToken = randomToken();
    user.emailVerificationToken = verifyToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    if (!skipEmailVerification()) {
      await sendVerificationEmail(email, verifyToken);
    }

    return res.json(generic);
  } catch (error) {
    return res.status(500).json({ message: "Could not resend verification" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = parseEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: "Valid email required" });
    }

    const user = await User.findOne({ email });
    const generic = { message: "If an account exists for that email, a reset link was sent." };

    if (!user) {
      return res.json(generic);
    }

    const resetToken = randomToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail(email, resetToken);
    return res.json(generic);
  } catch (error) {
    return res.status(500).json({ message: "Could not process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const token = parseOpaqueToken(req.body?.token);
    const password = parsePassword(req.body?.password);
    if (!token || !password) {
      return res.status(400).json({ message: "Invalid token or password" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    return res.status(500).json({ message: "Could not reset password" });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const oid = assertObjectId(req.user.id);
    if (!oid) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(oid).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch profile" });
  }
});

router.put("/profile/stats", authMiddleware, async (req, res) => {
  try {
    const game = parseGameKey(req.body?.game);
    const highScore = parseFiniteNumber(req.body?.highScore, 0);
    const bestTime = parseFiniteNumber(req.body?.bestTime, 0);
    const progress = parseFiniteNumber(req.body?.progress, 0);
    if (!game) {
      return res.status(400).json({ message: "Invalid or missing game key" });
    }
    if (highScore === null || bestTime === null || progress === null) {
      return res.status(400).json({ message: "Invalid numeric fields" });
    }

    const oid = assertObjectId(req.user.id);
    if (!oid) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(oid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ code: "EMAIL_NOT_VERIFIED", message: "Verify your email to save progress." });
    }

    const current = user.gameStats.get(game) || {};
    const nextStats = {
      highScore: Math.max(current.highScore || 0, Math.max(0, highScore)),
      bestTime: current.bestTime
        ? Math.min(current.bestTime, bestTime > 0 ? bestTime : current.bestTime)
        : bestTime > 0
          ? bestTime
          : 0,
      progress: Math.max(current.progress || 0, Math.min(100, Math.max(0, progress))),
      updatedAt: new Date()
    };

    user.gameStats.set(game, nextStats);
    await user.save();

    return res.json({ message: "Stats updated", game, stats: nextStats });
  } catch (error) {
    return res.status(500).json({ message: "Could not update stats" });
  }
});

module.exports = router;
