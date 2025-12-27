const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://ambeshjha077_db_user:NdiblChKtziYx7ml@cluster0.hwfuocw.mongodb.net/?appName=Cluster0");
    console.log("MongoDB Connected");
  } catch (err) {
    console.log("DB Error", err);
    process.exit(1);
  }
};

module.exports = connectDB;
