const Razorpay = require('razorpay');
const logger = require('./logger');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Verify webhook signature
const verifyWebhookSignature = (body, signature) => {
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
};

// Create order
const createOrder = async (amount, currency = 'INR', receipt = null) => {
  try {
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    logger.info(`Razorpay order created: ${order.id}`);
    return order;
  } catch (error) {
    logger.error('Error creating Razorpay order:', error);
    throw error;
  }
};

// Verify payment
const verifyPayment = async (paymentId, orderId, signature) => {
  try {
    const crypto = require('crypto');
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === signature;
    
    if (isAuthentic) {
      logger.info(`Payment verified successfully: ${paymentId}`);
      return true;
    } else {
      logger.warn(`Payment verification failed: ${paymentId}`);
      return false;
    }
  } catch (error) {
    logger.error('Error verifying payment:', error);
    return false;
  }
};

module.exports = {
  razorpay,
  verifyWebhookSignature,
  createOrder,
  verifyPayment,
};
