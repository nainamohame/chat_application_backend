const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const conversationRoutes = require("./routes/conversation.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Chat application backend is running successfully",
  });
});

app.use((_req, res) => res.status(404).json({ success: false, message: "Not found" }));
app.use(errorHandler);

module.exports = app;
