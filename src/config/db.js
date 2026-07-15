const mongoose = require("mongoose");

async function connectDB() {
  // Default matches .env.example for local dev if .env is missing.
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/puzzle-platform";
  if (!process.env.MONGO_URI) {
    console.warn("MONGO_URI not set; using default local MongoDB URI.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
}

module.exports = connectDB;
