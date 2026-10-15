const mongoose = require("mongoose");
const Product = require("../models/Product");

const getProducts = async (req, res) => {
  try {
    const filter = { active: true };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      filter.$text = { $search: search };
    }

    const products = await Product.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Products error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = mongoose.isValidObjectId(id)
      ? await Product.findOne({ _id: id, active: true }).lean()
      : await Product.findOne({ slug: id, active: true }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.json({ success: true, product });
  } catch (error) {
    console.error("Product details error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve product.",
    });
  }
};

module.exports = { getProducts, getProductById };
