const nodemailer = require("nodemailer");

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure:
    String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
});

const isEmailConfigured = () => {
  const config = getSmtpConfig();

  return Boolean(
    config.host &&
      config.port &&
      config.user &&
      config.pass &&
      process.env.SELLER_NOTIFICATION_EMAIL
  );
};

const createTransporter = () => {
  const config = getSmtpConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const sendSellerOrderNotification = async (order) => {
  if (!isEmailConfigured()) {
    console.warn(
      "Seller email notification skipped: SMTP credentials are not configured."
    );
    return {
      sent: false,
      skipped: true,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const transporter = createTransporter();

  const itemsText = order.items
    .map(
      (item) =>
        `${item.name} × ${item.quantity} — ${formatCurrency(
          item.unitPrice * item.quantity
        )}`
    )
    .join("\n");

  const shippingAddress = order.shippingAddress || {};

  const addressText = [
    shippingAddress.addressLine1,
    shippingAddress.addressLine2,
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.postalCode,
    shippingAddress.country,
  ]
    .filter(Boolean)
    .join(", ");

  const sellerEmail = process.env.SELLER_NOTIFICATION_EMAIL;
  const fromEmail =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    sellerEmail;

  const mailOptions = {
    from: fromEmail,
    to: sellerEmail,
    subject: `New Paid Order - Touch Energy - ${order._id}`,
    text: `
NEW PAID ORDER
==============

Order ID:
${order._id}

Customer
--------
Name: ${order.shippingAddress?.name || "Not provided"}
Email: ${order.customerEmail}
Phone: ${shippingAddress.phone || "Not provided"}

Products
--------
${itemsText}

Payment
-------
Payment Method: ${order.paymentMethod}
Payment Status: ${order.paymentStatus}
Order Status: ${order.orderStatus}
Total Paid: ${formatCurrency(order.total)}
Razorpay Order ID: ${order.razorpayOrderId || "Not available"}
Razorpay Payment ID: ${order.razorpayPaymentId || "Not available"}

Shipping Address
----------------
${addressText || "Not provided"}

This notification was generated automatically after the Razorpay payment was confirmed.
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("Seller order notification email sent:", {
      messageId: info.messageId,
      orderId: String(order._id),
      recipient: sellerEmail,
    });

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Seller order notification email failed:", {
      orderId: String(order._id),
      message: error.message,
    });

    return {
      sent: false,
      skipped: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendSellerOrderNotification,
};

