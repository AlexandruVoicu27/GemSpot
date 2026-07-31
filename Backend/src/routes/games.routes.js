const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json([
    {
      id: "1",
      title: "Moonlit Delivery",
      creator: "RivaByte",
      tag: "Platformer",
      score: "4.8",
      plays: "18.2k",
      reviews: 1240,
      mode: "Browser Play",
      palette: "sunset",
    },
  ]);
});

router.get("/:id", (req, res) => {
  res.json({
    message: "Game details",
    gameId: req.params.id,
  });
});

router.get("/:id/reviews", (req, res) => {
  res.json({
    message: "Game reviews",
    gameId: req.params.id,
  });
});

module.exports = router;