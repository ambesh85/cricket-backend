const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  masterId: { type: String, unique: true },
  name: String,
  email: String,
  password: String,
  credits: { type: Number, default: 1000 },
  role: { type: String, default: "USER" }
});

module.exports = mongoose.model("User", userSchema);
