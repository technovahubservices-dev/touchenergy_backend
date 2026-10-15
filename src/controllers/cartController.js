const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  return cart;
};

const findProduct = async (id) => {
  if (mongoose.isValidObjectId(id)) {
    const product = await Product.findOne({
      _id: id,
      active: true,
    });

    if (product) return product;
  }

  return Product.findOne({
    slug: String(id),
    active: true,
  });
};

const cartResponse = async (cart) => {
  await cart.populate("items.product");

  const items = cart.items
    .filter((item) => item.product && item.product.active)
    .map((item) => {
      const product = item.product;
      const lineTotal =
        product.price == null ? null : product.price * item.quantity;

      return {
        product: {
          id: product.slug,
          mongoId: product._id,
          name: product.name,
          slug: product.slug,
          image: product.image,
          price: product.price,
          stockQuantity: product.stockQuantity,
        },
        quantity: item.quantity,
        lineTotal,
      };
    });

  const pricedItems = items.filter(
    (item) => item.lineTotal !== null
  );

  return {
    items,
    subtotal: pricedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0
    ),
    itemCount: items.reduce(
      (sum, item) => sum + item.quantity,
      0
    ),
  };
};

const getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);

    return res.json({
      success: true,
      cart: await cartResponse(cart),
    });
  } catch (error) {
    console.error("Get cart error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve cart.",
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (
      typeof productId !== "string" ||
      !productId.trim() ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid product ID and quantity (1–20) are required.",
      });
    }

    const product = await findProduct(productId.trim());

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const cart = await getOrCreateCart(req.user._id);

    const existing = cart.items.find(
      (item) => item.product.toString() === product._id.toString()
    );

    const requestedQuantity =
      (existing?.quantity || 0) + quantity;

    if (existing) {
      existing.quantity = requestedQuantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
      });
    }

    await cart.save();

    return res.json({
      success: true,
      cart: await cartResponse(cart),
    });
  } catch (error) {
    console.error("Add to cart error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to add product to cart.",
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid quantity (1–20) is required.",
      });
    }

    const product = await findProduct(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const cart = await getOrCreateCart(req.user._id);

    const item = cart.items.find(
      (entry) =>
        entry.product.toString() === product._id.toString()
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found.",
      });
    }

    item.quantity = quantity;

    await cart.save();

    return res.json({
      success: true,
      cart: await cartResponse(cart),
    });
  } catch (error) {
    console.error("Update cart error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update cart.",
    });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await findProduct(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const cart = await getOrCreateCart(req.user._id);

    cart.items = cart.items.filter(
      (item) =>
        item.product.toString() !== product._id.toString()
    );

    await cart.save();

    return res.json({
      success: true,
      cart: await cartResponse(cart),
    });
  } catch (error) {
    console.error("Remove cart item error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to remove cart item.",
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);

    cart.items = [];
    await cart.save();

    return res.json({
      success: true,
      cart: await cartResponse(cart),
    });
  } catch (error) {
    console.error("Clear cart error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to clear cart.",
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};

