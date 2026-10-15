require("dotenv").config();
const mongoose = require("mongoose");

async function testTransaction() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      await session.abortTransaction();

      console.log("SUCCESS: MongoDB transactions are supported.");
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("TRANSACTION TEST FAILED:");
    console.error(error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testTransaction();
