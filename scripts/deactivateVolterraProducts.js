require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/Product");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const result = await Product.updateMany(
    {
      slug: {
        $in: ["volterra-core", "volterra-plus", "volterra-pro"]
      }
    },
    { $set: { active: false } }
  );

  console.log("Matched:", result.matchedCount);
  console.log("Deactivated:", result.modifiedCount);

  const products = await Product.find({
    slug: {
      $in: [
        "energy-box-1000",
        "tlf-1208100",
        "tlf-1208200",
        "tlf-2408100",
        "talis5",
        "talis7",
        "stack20",
        "volterra-core",
        "volterra-plus",
        "volterra-pro"
      ]
    }
  }).select("slug active").lean();

  console.table(products);
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
