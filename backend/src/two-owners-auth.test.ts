import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import prisma from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";

describe("Advance Pay — Two Independent Owners Auth & Scoping Verification", () => {
  let app: FastifyInstance;

  // Owner 1: Silk & Velvet Studio
  const owner1 = {
    name: "Kavya Menon",
    businessName: "Silk & Velvet Studio",
    email: `kavya_${Date.now()}@silkandvelvet.com`,
    phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "BoutiquePass2026!",
    confirmPassword: "BoutiquePass2026!",
  };

  // Owner 2: Zari Heritage Works
  const owner2 = {
    name: "Devendra Verma",
    businessName: "Zari Heritage Works",
    email: `devendra_${Date.now()}@zariheritage.com`,
    phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "BoutiquePass2026!",
    confirmPassword: "BoutiquePass2026!",
  };

  let token1: string;
  let token2: string;
  let owner1Id: number;
  let owner2Id: number;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secure_verification_secret_32_characters_minimum",
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      try {
        const token =
          request.cookies?.token ||
          request.headers.authorization?.replace(/^Bearer\s+/, "");
        if (!token) {
          return reply.code(401).send({ success: false, message: "Unauthorized" });
        }
        const decoded = await app.jwt.verify(token);
        request.user = decoded;
      } catch {
        return reply.code(401).send({ success: false, message: "Unauthorized" });
      }
    });

    await app.register(authRoutes);
    await app.register(customerRoutes);
    await app.register(orderRoutes);
    await app.ready();
  });

  it("1. Registers Owner 1 successfully with business name and phone", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: owner1,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
    expect(res.json().data.name).toBe(owner1.name);
    expect(res.json().data.businessName).toBe(owner1.businessName);
  });

  it("2. Registers Owner 2 independently without being blocked", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: owner2,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
    expect(res.json().data.name).toBe(owner2.name);
    expect(res.json().data.businessName).toBe(owner2.businessName);
  });

  it("3. Logs in both owners and issues distinct authenticated sessions", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: owner1.email,
        password: owner1.password,
      },
    });
    expect(res1.statusCode).toBe(200);
    owner1Id = res1.json().data.id;
    const cookie1Header = String(res1.headers["set-cookie"]);
    token1 = cookie1Header.match(/token=([^;]+)/)?.[1] || "";
    expect(token1).toBeTruthy();

    const res2 = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: owner2.email,
        password: owner2.password,
      },
    });
    expect(res2.statusCode).toBe(200);
    owner2Id = res2.json().data.id;
    const cookie2Header = String(res2.headers["set-cookie"]);
    token2 = cookie2Header.match(/token=([^;]+)/)?.[1] || "";
    expect(token2).toBeTruthy();

    expect(owner1Id).not.toBe(owner2Id);
  });

  it("4. Verifies /auth/me reflects each owner's identity and boutique name", async () => {
    const me1 = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(me1.statusCode).toBe(200);
    expect(me1.json().data.name).toBe(owner1.name);
    expect(me1.json().data.businessName).toBe(owner1.businessName);
    expect(me1.json().data.role).toBe("owner");

    const me2 = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(me2.statusCode).toBe(200);
    expect(me2.json().data.name).toBe(owner2.name);
    expect(me2.json().data.businessName).toBe(owner2.businessName);
    expect(me2.json().data.role).toBe("owner");
  });
});

