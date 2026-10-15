const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");

const createOrder = async (req, res) => {
  try {
    const {
      items,
      customerEmail,
      shippingAddress,
      paymentMethod = "BANK_TRANSFER",
    } = req.body;

    if (
      typeof customerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (!["BANK_TRANSFER", "ONLINE"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment method.",
      });
    }

    const required = [
      "name",
      "phone",
      "addressLine1",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    if (
      !shippingAddress ||
      required.some(
        (key) =>
          typeof shippingAddress[key] !== "string" ||
          !shippingAddress[key].trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete all required shipping address fields.",
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty or invalid.",
      });
    }

    const orderItems = [];
    const seen = new Set();
    let subtotal = 0;
    let hasUnpricedItems = false;

    for (const item of items) {
      const productId =
        typeof item.productId === "string" ? item.productId.trim() : "";
      const quantity = Number(item.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "A cart item has an invalid product or quantity.",
        });
      }

      const query = mongoose.isValidObjectId(productId)
        ? { _id: productId, active: true }
        : { slug: productId.toLowerCase(), active: true };

      const product = await Product.findOne(query);

      if (!product) {
        return res.status(409).json({
          success: false,
          message: "A product in your cart is unavailable.",
        });
      }

      const id = String(product._id);

      if (seen.has(id)) {
        return res.status(400).json({
          success: false,
          message: "Duplicate products found in the cart.",
        });
      }

      seen.add(id);

      const unitPrice =
        typeof product.price === "number" &&
        Number.isFinite(product.price)
          ? product.price
          : null;

      if (unitPrice === null) {
        hasUnpricedItems = true;
      } else {
        subtotal += unitPrice * quantity;
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image || "",
        quantity,
        unitPrice,
      });
    }

    const userId = req.user._id;

    const order = await Order.create({
      user: userId,
      customerEmail: customerEmail.trim().toLowerCase(),
      items: orderItems,
      shippingAddress: {
        name: shippingAddress.name.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: (shippingAddress.addressLine2 || "").trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim(),
      },
      subtotal: hasUnpricedItems ? null : subtotal,
      shippingFee: null,
      total: hasUnpricedItems ? null : subtotal,
      requestType: "QUOTE_REQUESTED",
      paymentMethod,
      paymentStatus: "PENDING",
      orderStatus: "QUOTE_REQUESTED",
    });

    return res.status(201).json({
      success: true,
      message: "Quote request saved successfully.",
      order,
    });
  } catch (error) {
    console.error("Quote request error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save your quote request.",
    });
  }
};

const createBuyNowOrder = async (req, res) => {
  let order;

  try {
    const {
      productId,
      quantity = 1,
      customerEmail,
      shippingAddress,
    } = req.body;

    if (
      typeof customerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity.",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required.",
      });
    }

    const required = [
      "name",
      "phone",
      "addressLine1",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    if (
      required.some(
        (key) =>
          typeof shippingAddress[key] !== "string" ||
          !shippingAddress[key].trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete all required shipping address fields.",
      });
    }

    const cleanProductId =
      typeof productId === "string" ? productId.trim() : "";

    if (!cleanProductId) {
      return res.status(400).json({
        success: false,
        message: "Product is required.",
      });
    }

    const query = mongoose.isValidObjectId(cleanProductId)
      ? { _id: cleanProductId, active: true }
      : { slug: cleanProductId.toLowerCase(), active: true };

    const product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product is unavailable.",
      });
    }

    const unitPrice =
      typeof product.price === "number" &&
      Number.isFinite(product.price) &&
      product.price > 0
        ? product.price
        : null;

    if (unitPrice === null) {
      return res.status(400).json({
        success: false,
        message: "This product is currently available by quote only.",
      });
    }

    const subtotal = unitPrice * parsedQuantity;

    const shippingFee = 0;
    const total = subtotal + shippingFee;

    const razorpayAmount = Math.round(total * 100);

    if (!Number.isInteger(razorpayAmount) || razorpayAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount.",
      });
    }

    order = await Order.create({
      user: req.user._id,
      customerEmail: customerEmail.trim().toLowerCase(),

      items: [
        {
          product: product._id,
          name: product.name,
          image: product.image || "",
          quantity: parsedQuantity,
          unitPrice,
        },
      ],

      shippingAddress: {
        name: shippingAddress.name.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: (shippingAddress.addressLine2 || "").trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim(),
      },

      subtotal,
      shippingFee,
      total,

      requestType: "DIRECT_PURCHASE",
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      orderStatus: "PAYMENT_PENDING",
    });

    const {
      createRazorpayOrder,
    } = require("../services/razorpayService");

    const razorpayOrder = await createRazorpayOrder({
      amount: razorpayAmount,
      currency: "INR",
      receipt: `order_${order._id}`,
      notes: {
        mongoOrderId: String(order._id),
        userId: String(req.user._id),
        productId: String(product._id),
      },
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully.",
      order: {
        id: order._id,
        total: order.total,
        currency: "INR",
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      },
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error("Buy now order error:", error);

    if (typeof order !== "undefined" && order?._id) {
      try {
        await Order.deleteOne({
          _id: order._id,
          user: req.user._id,
          paymentStatus: "PENDING",
          orderStatus: "PAYMENT_PENDING",
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up pending Buy Now order:",
          cleanupError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order.",
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Order history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve orders.",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.json({ success: true, order });
  } catch (error) {
    console.error("Order details error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order.",
    });
  }
};


const createCartBuyNowOrder = async (req, res) => {
  let order;

  try {
    const {
      items,
      customerEmail,
      shippingAddress,
    } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty or contains too many products.",
      });
    }

    if (
      typeof customerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (!shippingAddress || typeof shippingAddress !== "object") {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required.",
      });
    }

    const requiredAddressFields = [
      "name",
      "phone",
      "addressLine1",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    for (const field of requiredAddressFields) {
      if (
        typeof shippingAddress[field] !== "string" ||
        !shippingAddress[field].trim()
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} is required.`,
        });
      }
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productId = item?.productId;
      const quantity = Number(item?.quantity);

      if (
        typeof productId !== "string" ||
        !productId.trim() ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid cart item.",
        });
      }

      const query = mongoose.isValidObjectId(productId)
        ? { _id: productId, active: true }
        : { slug: productId.toLowerCase(), active: true };

      const product = await Product.findOne(query);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "A product in your cart is unavailable.",
        });
      }

      const unitPrice =
        typeof product.price === "number" &&
        Number.isFinite(product.price) &&
        product.price > 0
          ? product.price
          : null;

      if (unitPrice === null) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is currently available by quote only.`,
        });
      }

      subtotal += unitPrice * quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image || "",
        quantity,
        unitPrice,
      });
    }

    const shippingFee = 0;
    const total = subtotal + shippingFee;
    const razorpayAmount = Math.round(total * 100);

    if (!Number.isInteger(razorpayAmount) || razorpayAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount.",
      });
    }

    order = await Order.create({
      user: req.user._id,
      customerEmail: customerEmail.trim().toLowerCase(),

      items: orderItems,

      shippingAddress: {
        name: shippingAddress.name.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: (shippingAddress.addressLine2 || "").trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim(),
      },

      subtotal,
      shippingFee,
      total,

      requestType: "DIRECT_PURCHASE",
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      orderStatus: "PAYMENT_PENDING",
    });

    const {
      createRazorpayOrder,
    } = require("../services/razorpayService");

    const razorpayOrder = await createRazorpayOrder({
      amount: razorpayAmount,
      currency: "INR",
      receipt: `order_${order._id}`,
      notes: {
        mongoOrderId: String(order._id),
        userId: String(req.user._id),
        cartItemCount: String(orderItems.length),
      },
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(201).json({
      success: true,
      message: "Cart payment order created successfully.",
      order: {
        id: order._id,
        total: order.total,
        currency: "INR",
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        items: order.items,
      },
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error("Cart payment order error:", error);

    if (typeof order !== "undefined" && order?._id) {
      try {
        await Order.deleteOne({
          _id: order._id,
          user: req.user._id,
          paymentStatus: "PENDING",
          orderStatus: "PAYMENT_PENDING",
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up pending cart payment order:",
          cleanupError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create your payment order.",
    });
  }
};

module.exports = {
  createCartBuyNowOrder,
  createOrder,
  createBuyNowOrder,
  getMyOrders,
  getOrderById,
};



