const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:productId", updateCartItem);
router.delete("/items/:productId", removeCartItem);
router.delete("/", clearCart);

module.exports = router;
