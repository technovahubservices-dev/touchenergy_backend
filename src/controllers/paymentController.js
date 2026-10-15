const crypto = require("crypto");
const Order = require("../models/Order");
const { sendSellerOrderNotification } = require("../services/emailService");

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return res.status(400).json({
        success: false,
        message: "Incomplete payment verification data.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Payment order mismatch.",
      });
    }

    /*
     * Razorpay Checkout signature verification.
     *
     * The signature is generated from:
     * razorpay_order_id + "|" + razorpay_payment_id
     */
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "utf8"),
      Buffer.from(razorpay_signature, "utf8")
    );

    if (!signaturesMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    /*
     * Idempotency:
     * If the payment was already recorded, don't create another
     * state transition.
     */
    if (order.paymentStatus === "PAID") {
      return res.json({
        success: true,
        message: "Payment already verified.",
        order: {
          id: order._id,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        },
      });
    }

    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;

    /*
     * Signature verification proves that the response came from
     * the Razorpay checkout flow, but the webhook remains the
     * authoritative payment confirmation mechanism.
     *
     * Keep the order pending here. The webhook will transition
     * it to PAID after Razorpay confirms the payment.
     */
    await order.save();

    return res.json({
      success: true,
      message: "Payment response verified. Waiting for payment confirmation.",
      order: {
        id: order._id,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      },
    });
  } catch (error) {
    console.error("Razorpay payment verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify payment.",
    });
  }
};

const razorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing webhook signature.",
      });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        message: "Webhook configuration is missing.",
      });
    }

    /*
     * req.rawBody must contain the exact bytes received from Razorpay.
     * This is why the webhook route will use express.raw().
     */
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody)
      .digest("hex");

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(webhookSignature, "utf8")
    );

    if (!signaturesMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const event = req.body;

    console.log("Razorpay webhook received:", event.event);

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;

      if (!payment) {
        return res.status(400).json({
          success: false,
          message: "Payment payload missing.",
        });
      }

      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      if (!razorpayOrderId || !razorpayPaymentId) {
        return res.status(400).json({
          success: false,
          message: "Payment identifiers missing.",
        });
      }

      const order = await Order.findOne({
        razorpayOrderId,
      });

      if (!order) {
        console.error(
          "Razorpay webhook order not found:",
          razorpayOrderId
        );

        /*
         * Return 200 so Razorpay does not repeatedly retry an event
         * that belongs to an unknown/old order.
         */
        return res.json({
          success: true,
          message: "Webhook received.",
        });
      }

      /*
       * Idempotency:
       * Razorpay can retry webhook delivery. Repeated captured
       * events must not create duplicate state changes.
       */
      if (order.paymentStatus === "PAID") {
        return res.json({
          success: true,
          message: "Payment already processed.",
        });
      }

      /*
       * Validate the amount before marking the order paid.
       * Razorpay amount is in paise; our MongoDB total is in rupees.
       */
      const expectedAmount = Math.round(Number(order.total) * 100);

      if (payment.amount !== expectedAmount) {
        console.error("Razorpay amount mismatch:", {
          orderId: order._id,
          expectedAmount,
          receivedAmount: payment.amount,
          razorpayOrderId,
        });

        return res.status(400).json({
          success: false,
          message: "Payment amount mismatch.",
        });
      }

      /*
       * Only a captured payment transitions the order to PAID.
       */
      if (payment.status === "captured") {
        order.razorpayPaymentId = razorpayPaymentId;
        order.paymentStatus = "PAID";
        order.orderStatus = "PLACED";
        order.paidAt = new Date();

        await order.save();

        /*
         * Seller notification:
         * Send only once successfully for this order.
         *
         * If SMTP is not configured or sending fails, the order
         * remains PAID and sellerNotificationSentAt stays null.
         * This allows a later webhook/retry to attempt the email again.
         */
        if (!order.sellerNotificationSentAt) {
          const notificationResult =
            await sendSellerOrderNotification(order);

          if (notificationResult?.sent) {
            order.sellerNotificationSentAt = new Date();
            order.sellerNotificationMessageId =
              notificationResult.messageId || null;

            await order.save();

            console.log("Seller order notification sent:", {
              orderId: order._id,
              messageId: notificationResult.messageId || null,
            });
          } else {
            console.warn(
              "Seller order notification was not sent:",
              notificationResult?.message ||
                "Unknown email notification error."
            );
          }
        } else {
          console.log(
            "Seller order notification already sent:",
            order._id
          );
        }

        console.log("Razorpay payment marked PAID:", {
          orderId: order._id,
          razorpayOrderId,
          razorpayPaymentId,
        });
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;

      if (payment?.order_id) {
        const order = await Order.findOne({
          razorpayOrderId: payment.order_id,
        });

        if (order && order.paymentStatus !== "PAID") {
          order.paymentStatus = "FAILED";
          await order.save();
        }
      }
    }

    return res.json({
      success: true,
      message: "Webhook processed.",
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};

module.exports = {
  verifyRazorpayPayment,
  razorpayWebhook,
};





