const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: { type: String, required: true },
        image: { type: String, default: "" },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, default: null, min: 0 },
      },
    ],

    shippingAddress: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      addressLine1: { type: String, required: true, trim: true },
      addressLine2: { type: String, default: "", trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },

    subtotal: {
      type: Number,
      default: null,
      min: 0,
    },

    shippingFee: {
      type: Number,
      default: null,
      min: 0,
    },

    total: {
      type: Number,
      default: null,
      min: 0,
    },

    requestType: {
      type: String,
      enum: ["QUOTE_REQUESTED", "DIRECT_PURCHASE"],
      default: "QUOTE_REQUESTED",
    },

    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "ONLINE"],
      default: "BANK_TRANSFER",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },

    orderStatus: {
      type: String,
      enum: [
        "QUOTE_REQUESTED",
        "PAYMENT_PENDING",
        "PLACED",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "QUOTE_REQUESTED",
    },

    // Razorpay payment tracking
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    // Seller email notification tracking
    sellerNotificationSentAt: {
      type: Date,
      default: null,
    },

    sellerNotificationMessageId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
