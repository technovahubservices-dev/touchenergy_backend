const Razorpay = require("razorpay");

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "Razorpay configuration is missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
  );
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

const createRazorpayOrder = async ({
  amount,
  currency = "INR",
  receipt,
  notes = {},
}) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(
      "Razorpay amount must be a positive integer in paise."
    );
  }

  return razorpay.orders.create({
    amount,
    currency,
    receipt,
    notes,
  });
};

module.exports = {
  razorpay,
  createRazorpayOrder,
};