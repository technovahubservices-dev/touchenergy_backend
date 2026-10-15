const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
require("dotenv").config();

const Product = require("../src/models/Product");

const frontendFile =
  "E:/inverter/touchenergy-frontend/src/data/products.js";

const tempFile =
  "E:/inverter/touchenergy-frontend/.products-sync-temp.mjs";

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the backend .env file.");
  }

  if (!fs.existsSync(frontendFile)) {
    throw new Error(`Frontend product file not found: ${frontendFile}`);
  }

  // Make the Vite product module readable by Node without changing
  // the original frontend source file.
  let source = fs.readFileSync(frontendFile, "utf8");
  source = source.replace(/import\.meta\.env\.BASE_URL/g, '""');
  fs.writeFileSync(tempFile, source, "utf8");

  try {
    const moduleUrl =
      pathToFileURL(tempFile).href + `?sync=${Date.now()}`;
    const { default: products } = await import(moduleUrl);

    if (!Array.isArray(products) || products.length !== 7) {
      throw new Error(
        `Expected 7 products; found ${
          Array.isArray(products) ? products.length : "invalid data"
        }. No database changes made.`
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const allowedProducts = products.map((p) => ({
      name: p.name,
      slug: p.id,
      category: p.category,
      tagline: p.tagline || "",
      description: p.description || "",
      price: p.price ?? null,
      image: p.image || "",
      images: p.images || [],
      features: p.features || [],
      specifications: p.specifications || {},
      active: true,
    }));

    for (const product of allowedProducts) {
      await Product.updateOne(
        { slug: product.slug },
        { $set: product, $setOnInsert: { stockQuantity: 0 } },
        { upsert: true, runValidators: true }
      );

      console.log(`Synced: ${product.slug}`);
    }

    const synced = await Product.find({
      slug: { $in: allowedProducts.map((p) => p.slug) },
    })
      .select("name slug price active")
      .lean();

    console.log("\nVerification:");
    console.table(synced);
    console.log(`Verified ${synced.length} Touch Energy products.`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error("Product sync failed:", error.message);
  process.exitCode = 1;
});
