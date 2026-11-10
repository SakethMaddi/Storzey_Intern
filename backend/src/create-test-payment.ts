
import prisma from "./lib/prisma.js";

async function main() {
  const payment = await prisma.payment.create({
    data: {
      orderId: 10,
      amount: 2000,
      paymentType: "ADVANCE",
      status: "PENDING",
      razorpayOrderId: "test_razorpay_order_10",
    },
  });

  console.log("Test payment created:", payment);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
