const express = require("express");
const cors = require("cors");
const gamesRoutes = require("./routes/games.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/games", gamesRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GemSpot API running on http://localhost:${port}`);
});