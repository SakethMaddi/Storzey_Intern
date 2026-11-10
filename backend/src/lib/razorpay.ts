
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const hasValidCredentials =
  Boolean(keyId && keySecret) &&
  !keyId?.startsWith("your_") &&
  !keySecret?.startsWith("your_");

const razorpay = hasValidCredentials
  ? new Razorpay({
      key_id: keyId!,
      key_secret: keySecret!,
    })
  : null;

export default razorpay;
