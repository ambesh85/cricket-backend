console.log("✅ BACKEND INDEX.JS LOADED");

/* ================== IMPORTS ================== */
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const axios = require("axios");

/* ================== CONFIG ================== */
const app = express();
const PORT = 5000;

const JWT_SECRET = "ADMIN_SECRET_123";
const CRIC_API_KEY = "f46e8885-b9ee-4de3-b383-73b0645de92d";

// Toggle when you add paid odds (Betfair later)
const USE_PAID_ODDS = false;

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(express.json());

/* ================== MONGODB ================== */
mongoose
  .connect(
    "mongodb+srv://ambesh139:Vidya%40139140@cluster0.hwfuocw.mongodb.net/ambesh139"
  )
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ Mongo Error:", err));

/* ================== MODELS ================== */

// USER
const UserSchema = new mongoose.Schema({
  masterId: String,
  name: String,
  email: { type: String, unique: true },
  password: String,
  credits: { type: Number, default: 1000 },
});

// TRANSACTION
const TransactionSchema = new mongoose.Schema({
  masterId: String,
  type: String, // CREDIT / DEBIT
  amount: Number,
  reason: String,
  balanceAfter: Number,
  date: { type: Date, default: Date.now },
});

// BET
const BetSchema = new mongoose.Schema({
  masterId: String,
  matchId: String,
  team: String,
  odds: Number,
  amount: Number,
  status: { type: String, default: "PENDING" }, // PENDING | WON | LOST
  payout: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Transaction = mongoose.model("Transaction", TransactionSchema);
const Bet = mongoose.model("Bet", BetSchema);

/* ================== HELPERS ================== */
const generateMasterId = async () => {
  const count = await User.countDocuments();
  return `USER-2025-${String(count + 1).padStart(4, "0")}`;
};

const getDemoOdds = (matchId) => ({
  matchId,
  odds: {
    teamA: Number((1.5 + Math.random()).toFixed(2)),
    teamB: Number((2 + Math.random()).toFixed(2)),
  },
  source: "DEMO",
});
/* ---------- AUTO SETTLE USING REAL RESULT ---------- */
const autoSettleMatch = async (match) => {
  try {
    if (!match.matchWinner) return;

    const winningTeam =
      match.matchWinner === match.teams[0] ? "teamA" : "teamB";

    const bets = await Bet.find({
      matchId: match.id,
      status: "PENDING",
    });

    for (const bet of bets) {
      const user = await User.findOne({ masterId: bet.masterId });
      if (!user) continue;

      if (bet.team === winningTeam) {
        const payout = bet.amount * bet.odds;
        user.credits += payout;
        bet.status = "WON";
        bet.payout = payout;

        await Transaction.create({
          masterId: bet.masterId,
          type: "CREDIT",
          amount: payout,
          reason: `AUTO WIN | Match ${match.id}`,
          balanceAfter: user.credits,
        });
      } else {
        bet.status = "LOST";
        bet.payout = 0;
      }

      await user.save();
      await bet.save();
    }
  } catch (err) {
    console.log("Auto settle error:", err.message);
  }
};

/* ================== ROUTES ================== */

// ROOT
app.get("/", (req, res) => {
  res.send("Backend Running Successfully");
});

/* ---------- USER REGISTER ---------- */
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const masterId = await generateMasterId();

    const user = await User.create({
      masterId,
      name,
      email,
      password: hashed,
    });

    res.json({
      message: "User registered",
      masterId: user.masterId,
      credits: user.credits,
    });
  } catch {
    res.status(500).json({ message: "Registration failed" });
  }
});

/* ---------- USER LOGIN ---------- */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    res.json({
      masterId: user.masterId,
      name: user.name,
      email: user.email,
      credits: user.credits,
    });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

/* ---------- ADMIN LOGIN ---------- */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== "admin" || password !== "admin123") {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, {
    expiresIn: "2h",
  });

  res.json({ token });
});

/* ---------- ADMIN GET USERS ---------- */
app.get("/api/admin/users", async (req, res) => {
  const users = await User.find({}, { password: 0, __v: 0 });
  res.json(users);
});

/* ---------- LIVE CRICKET MATCHES + AUTO SETTLE ---------- */
app.get("/api/cricket/live", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.cricapi.com/v1/currentMatches?apikey=${CRIC_API_KEY}&offset=0`
    );

    const matches = response.data.data;

    // 🔥 AUTO SETTLE COMPLETED MATCHES
    for (const match of matches) {
      if (
        match.status?.toLowerCase().includes("completed") &&
        match.matchWinner
      ) {
        await autoSettleMatch(match);
      }
    }

    res.json(matches);
  } catch {
    res.status(500).json({ message: "Failed to fetch matches" });
  }
});

/* ---------- ODDS API ---------- */
app.get("/api/odds/:matchId", (req, res) => {
  if (USE_PAID_ODDS) {
    return res.status(501).json({ message: "Paid odds not enabled" });
  }
  res.json(getDemoOdds(req.params.matchId));
});

/* ---------- PLACE BET ---------- */
app.post("/api/bet/place", async (req, res) => {
  try {
    const { masterId, matchId, team, odds, amount } = req.body;

    const user = await User.findOne({ masterId });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.credits < amount)
      return res.status(400).json({ message: "Insufficient credits" });

    user.credits -= amount;
    await user.save();

    await Bet.create({
      masterId,
      matchId,
      team,
      odds,
      amount,
    });

    await Transaction.create({
      masterId,
      type: "DEBIT",
      amount,
      reason: `Bet placed | Match ${matchId}`,
      balanceAfter: user.credits,
    });

    res.json({
      message: "Bet placed successfully",
      updatedCredits: user.credits,
    });
  } catch {
    res.status(500).json({ message: "Bet failed" });
  }
});

/* ---------- ADMIN SETTLE BETS ---------- */
app.post("/api/admin/settle", async (req, res) => {
  try {
    const { matchId, winningTeam } = req.body;

    const bets = await Bet.find({ matchId, status: "PENDING" });

    if (bets.length === 0) {
      return res.json({ message: "No pending bets" });
    }

    for (const bet of bets) {
      const user = await User.findOne({ masterId: bet.masterId });
      if (!user) continue;

      if (bet.team === winningTeam) {
        const payout = bet.amount * bet.odds;
        user.credits += payout;
        bet.status = "WON";
        bet.payout = payout;

        await Transaction.create({
          masterId: bet.masterId,
          type: "CREDIT",
          amount: payout,
          reason: `Bet WON | Match ${matchId}`,
          balanceAfter: user.credits,
        });
      } else {
        bet.status = "LOST";
        bet.payout = 0;
      }

      await user.save();
      await bet.save();
    }

    res.json({ message: "Match settled successfully" });
  } catch {
    res.status(500).json({ message: "Settlement failed" });
  }
});

/* ---------- USER TRANSACTIONS ---------- */
app.get("/api/user/transactions/:masterId", async (req, res) => {
  const tx = await Transaction.find({
    masterId: req.params.masterId,
  }).sort({ date: -1 });

  res.json(tx);
});

/* ================== SERVER ================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
