require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const User = require("./models/User");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 12) {
  console.error("JWT_SECRET must be set and at least 12 characters.");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));
// Strip keys that start with $ or contain . from body/query/params (NoSQL operator injection).
app.use(mongoSanitize());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    // Grandfather existing accounts created before email verification (no field in DB).
    await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
