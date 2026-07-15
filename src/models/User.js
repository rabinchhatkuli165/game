const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Stores game progress/high scores per game name.
    gameStats: {
      type: Map,
      of: {
        highScore: { type: Number, default: 0 },
        bestTime: { type: Number, default: 0 },
        progress: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now }
      },
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
