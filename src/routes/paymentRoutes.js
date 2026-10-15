const express = require("express");

const {
  verifyRazorpayPayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/*
 * Called by the frontend after Razorpay Checkout completes.
 * The backend verifies the Razorpay signature and keeps the
 * order pending until the authoritative webhook confirms payment.
 */
router.post("/verify", protect, verifyRazorpayPayment);

module.exports = router;
