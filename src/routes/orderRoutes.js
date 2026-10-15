const express = require("express");

const {
  createOrder,
  createBuyNowOrder,
  createCartBuyNowOrder,
  getMyOrders,
  getOrderById,
} = require("../controllers/orderController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Existing RFQ / order-request flow.
router.post("/", protect, createOrder);

// Direct purchase with Razorpay.
router.post("/buy-now", protect, createBuyNowOrder);

// Cart purchase with Razorpay.
router.post("/cart-buy-now", protect, createCartBuyNowOrder);

// Order history and details.
router.get("/", protect, getMyOrders);
router.get("/:id", protect, getOrderById);

module.exports = router;
