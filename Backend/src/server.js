require("dotenv").config();

const authRoutes = require("./routes/auth.routes");

const express = require("express");
const cors = require("cors");
const gamesRoutes = require("./routes/games.routes");
const uploadsRoutes = require("./routes/uploads.routes");
const adminRoutes = require("./routes/admin.routes");
const requireAuth = require("./middleware/requireAuth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
  
app.use("/api/auth", authRoutes);
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use("/api/games", gamesRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GemSpot API running on http://localhost:${port}`);
  uploadsRoutes.resumePendingUploads();
});
