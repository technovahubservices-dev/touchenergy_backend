require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Product = require("../src/models/Product");

const sampleProducts = [
  {
    name: "Touch Energy Core",
    slug: "volterra-core",
    category: "Home",
    tagline: "Everyday power, refined.",
    description:
      "A sample residential inverter concept designed for essential everyday home backup.",
    price: 24999,
    image: "/images/products/inverter-main.png",
    images: ["/images/products/inverter-main.png"],
    features: [
      "Home backup",
      "Intelligent power management",
      "Protection-focused design"
    ],
    specifications: {
      productType: "Sample residential inverter",
      status: "Development sample"
    },
    stockQuantity: 10,
    active: true
  },
  {
    name: "Touch Energy Plus",
    slug: "volterra-plus",
    category: "Home",
    tagline: "More power. More continuity.",
    description:
      "A sample residential inverter concept for broader home backup requirements.",
    price: 34999,
    image: "/images/products/inverter-main.png",
    images: ["/images/products/inverter-main.png"],
    features: [
      "Extended home coverage",
      "Intelligent power management",
      "Protection-focused design"
    ],
    specifications: {
      productType: "Sample residential inverter",
      status: "Development sample"
    },
    stockQuantity: 10,
    active: true
  },
  {
    name: "Touch Energy Pro",
    slug: "volterra-pro",
    category: "Home",
    tagline: "Power without compromise.",
    description:
      "A sample residential inverter concept for broader everyday power requirements.",
    price: 49999,
    image: "/images/products/inverter-main.png",
    images: ["/images/products/inverter-main.png"],
    features: [
      "High-demand home backup",
      "Advanced power management",
      "Protection-focused design"
    ],
    specifications: {
      productType: "Sample residential inverter",
      status: "Development sample"
    },
    stockQuantity: 10,
    active: true
  }
];

async function seedProducts() {
  try {
    await connectDB();

    for (const product of sampleProducts) {
      await Product.updateOne(
        { slug: product.slug },
        { $set: product },
        { upsert: true, runValidators: true }
      );

      console.log(`Seeded: ${product.name}`);
    }

    console.log("Sample product seeding completed.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();

