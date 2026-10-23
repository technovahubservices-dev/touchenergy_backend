require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const {
  razorpayWebhook,
} = require("./controllers/paymentController");

const app = express();

app.disable("x-powered-by");

const clientUrl = process.env.CLIENT_URL;

if (process.env.NODE_ENV === "production" && !clientUrl) {
  console.error("CLIENT_URL must be configured in production");
  process.exit(1);
}

app.use(
  cors({
    origin: [
      clientUrl,
      "https://touchenergy.in",
      "https://www.touchenergy.in",
      "http://localhost:5173",
      "http://localhost:4173",
    ].filter(Boolean),
    credentials: true,
  })
);

/*
 * Razorpay webhook must receive the original raw request body
 * so its HMAC signature can be verified correctly.
 *
 * IMPORTANT:
 * This route must be registered BEFORE express.json().
 */
app.post(
  "/api/payments/razorpay/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;
    next();
  },
  razorpayWebhook
);

/*
 * Normal application API requests use JSON parsing.
 */
app.use(express.json({ limit: "20kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Touch Energy API is running",
  });
});

app.get("/api/health", (req, res) => {
  const isDatabaseConnected =
    mongoose.connection.readyState === 1;

  res.status(isDatabaseConnected ? 200 : 503).json({
    success: isDatabaseConnected,
    message: isDatabaseConnected
      ? "Touch Energy API is healthy"
      : "Database connection unavailable",
    database: isDatabaseConnected
      ? "connected"
      : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

const startServer = async () => {
  if (
    !process.env.MONGODB_URI ||
    !process.env.JWT_SECRET ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET ||
    !process.env.RAZORPAY_WEBHOOK_SECRET
  ) {
    console.error(
      "MONGODB_URI, JWT_SECRET, and Razorpay credentials must be configured in .env"
    );
    process.exit(1);
  }

  await connectDB();

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(
      `Touch Energy API running at http://localhost:${PORT}`
    );
  });
};

startServer();

