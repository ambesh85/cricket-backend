const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  masterId: String,
  amount: Number,
  type: String,
  reason: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
