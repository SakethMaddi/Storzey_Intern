import Fastify from "fastify";
import cors from "@fastify/cors";
import prisma from "./lib/prisma";

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
});
app.get("/", async () => {
  return {
    message: "Advance Pay API is running!",
  };
});

app.get("/customers", async () => {
  const customers = await prisma.customer.findMany();

  return {
    success: true,
    data: customers,
  };
});

app.post("/customers", async (request, reply) => {
  const { name, phone } = request.body as {
    name: string;
    phone: string;
  };

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
    },
  });

  return reply.code(201).send({
    success: true,
    data: customer,
  });
});

app.get("/orders", async () => {
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
    },
  });

  return {
    success: true,
    data: orders,
  };
});

app.post("/orders", async (request, reply) => {
  const { itemName, totalAmount, advance, customerId } =
    request.body as {
      itemName: string;
      totalAmount: number;
      advance: number;
      customerId: number;
    };

  if (
    !itemName?.trim() ||
    !Number.isInteger(totalAmount) ||
    !Number.isInteger(advance) ||
    !Number.isInteger(customerId) ||
    totalAmount <= 0 ||
    advance < 0 ||
    advance > totalAmount
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid order details or payment amounts",
    });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return reply.code(404).send({
      success: false,
      message: "Customer not found",
    });
  }
  const balance = totalAmount - advance;
  const order = await prisma.order.create({
    data: {
      itemName,
      totalAmount,
      advance,
      customerId,
      balance,
      paymentStatus: "PENDING",

      stages: {
        create: [
          { name: "Measurements" },
          { name: "Cutting" },
          { name: "Embroidery" },
          { name: "Trial" },
          { name: "Ready" },
        ],
      },
    },
  });

  return reply.code(201).send({
    success: true,
    data: order,
  });
});

app.get("/orders/:id/stages", async (request) => {
  const { id } = request.params as { id: string };

  const stages = await prisma.orderStage.findMany({
    where: {
      orderId: Number(id),
    },
  });

  return {
    success: true,
    data: stages,
  };
});

app.post("/orders/:id/stages", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { name } = request.body as { name: string };
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0 || !name?.trim()) {
    return reply.code(400).send({
      success: false,
      message: "Invalid order ID or stage name",
    });
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }
  const stage = await prisma.orderStage.create({
    data: {
      name: name.trim(),
      orderId,
    },
  });
  return reply.code(201).send({
    success: true,
    data: stage,
  });
});

app.get("/orders/:id/payments", async (request, reply) => {
  const { id } = request.params as { id: string };

  const orderId = Number(id);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }

  const payments = await prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: payments,
  };
});

app.post("/orders/:id/payments", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { amount, paymentType } = request.body as {
    amount: number;
    paymentType: string;
  };
  const orderId = Number(id);
  if (
    !Number.isInteger(orderId) ||
    orderId <= 0 ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    !["ADVANCE", "BALANCE"].includes(paymentType)
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid payment details",
    });
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }
  if (amount > order.balance) {
    return reply.code(400).send({
      success: false,
      message: "Payment cannot exceed remaining balance",
    });
  }
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orderId,
        amount,
        paymentType,
        status: "COMPLETED",
      },
    });
    const newBalance = order.balance - amount;
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        balance: newBalance,
        paymentStatus: newBalance === 0 ? "PAID" : "PARTIALLY_PAID",
      },
    });
    return { payment, updatedOrder };
  });
  return reply.code(201).send({
    success: true,
    data: result,
  });
});

app.patch("/stages/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  const stageId = Number(id);
  const allowedStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
  if (
    !Number.isInteger(stageId) ||
    stageId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid stage ID or status",
    });
  }
  const existingStage = await prisma.orderStage.findUnique({
    where: { id: stageId },
  });
  if (!existingStage) {
    return reply.code(404).send({
      success: false,
      message: "Stage not found",
    });
  }
  const stage = await prisma.orderStage.update({
    where: { id: stageId },
    data: { status },
  });
  return {
    success: true,
    data: stage,
  };
});

app.get("/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const order = await prisma.order.findUnique({
    where: {
      id: Number(id),
    },
    include: {
      customer: true,
      payments: true,
      stages: true,
    },
  });
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }
  return {
    success: true,
    data: order,
  };
});

const start = async () => {
  try {
    await app.listen({ port: 5000 });
    console.log("Server running at http://localhost:5000");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};
start();