const mongoose = require("mongoose");

// Reject Mongo query operators and non-strings before they reach Mongoose queries (NoSQL injection defense).
function isPlainString(value) {
  return typeof value === "string";
}

function trimString(value, maxLen) {
  const s = String(value).trim();
  if (s.length > maxLen) return null;
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmail(raw) {
  if (!isPlainString(raw)) return null;
  const email = trimString(raw, 254);
  if (!email || !EMAIL_RE.test(email)) return null;
  return email.toLowerCase();
}

function parseUsername(raw) {
  if (!isPlainString(raw)) return null;
  const u = trimString(raw, 32);
  if (!u || u.length < 3) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(u)) return null;
  return u;
}

function parsePassword(raw) {
  if (!isPlainString(raw)) return null;
  if (raw.length < 6 || raw.length > 128) return null;
  return raw;
}

/** Allowed keys for gameStats map — prevents arbitrary Map keys / prototype tricks. */
const ALLOWED_GAME_KEYS = new Set([
  "memoryMatch",
  "sudoku",
  "wordSearch",
  "game2048",
  "minesweeper",
  "reactionTap"
]);

function parseGameKey(raw) {
  if (!isPlainString(raw)) return null;
  const key = trimString(raw, 64);
  if (!key || !ALLOWED_GAME_KEYS.has(key)) return null;
  return key;
}

function parseFiniteNumber(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.length <= 32) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function assertObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/** One-time tokens (email verify / password reset) — hex from randomBytes(32). */
function parseOpaqueToken(raw) {
  if (!isPlainString(raw)) return null;
  const t = raw.trim();
  if (!/^[a-f0-9]{64}$/i.test(t)) return null;
  return t.toLowerCase();
}

module.exports = {
  parseEmail,
  parseUsername,
  parsePassword,
  parseGameKey,
  parseFiniteNumber,
  assertObjectId,
  parseOpaqueToken
};
