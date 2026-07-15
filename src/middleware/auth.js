const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Expect { id, email } from our own tokens only — reject odd payloads.
    if (!decoded || typeof decoded.id !== "string" || typeof decoded.email !== "string") {
      return res.status(401).json({ message: "Unauthorized: invalid token payload" });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

module.exports = authMiddleware;
