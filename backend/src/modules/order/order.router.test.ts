import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { createApp } from "../../app";
import { InMemoryAuthRepository } from "../auth/auth.repository";
import { InMemoryCatalogRepository } from "../catalog/catalog.repository";
import { createCatalogService } from "../catalog/pricing.service";
import { type PricingRuleRecord, type ProductRecord } from "../catalog/catalog.types";
import { InMemoryOrderRepository } from "./order.repository";
import { createOrderService } from "./order.service";

const createdAt = new Date("2026-05-14T12:00:00.000Z");

type RegisteredUser = Readonly<{
  user: Readonly<{ id: string }>;
  token: string;
}>;

function product(overrides: Partial<ProductRecord>): ProductRecord {
  return {
    id: "product-default",
    skuDigiflazz: "default-sku",
    name: "Default Product",
    category: "games",
    provider: "digiflazz",
    basePriceMinor: 10_000,
    isActive: true,
    metadata: {},
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

function pricingRule(overrides: Partial<PricingRuleRecord>): PricingRuleRecord {
  return {
    id: "rule-default",
    scopeType: "global",
    productId: null,
    category: null,
    roleType: "pengguna",
    markupFixed: 0,
    markupPercentage: 0,
    priority: 0,
    isActive: true,
    metadata: {},
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

async function registerUser(app: ReturnType<typeof createApp>, email: string): Promise<RegisteredUser> {
  const response = await request(app).post("/api/auth/register").send({
    email,
    password: "correct-password"
  });

  expect(response.status).toBe(201);
  return response.body as RegisteredUser;
}

function createOrderApp(options: {
  authRepository?: InMemoryAuthRepository;
  catalogRepository?: InMemoryCatalogRepository;
  orderRepository?: InMemoryOrderRepository;
} = {}) {
  const authRepository = options.authRepository;
  const catalogRepository = options.catalogRepository;
  const orderRepository = options.orderRepository ?? new InMemoryOrderRepository();
  const catalogService =
    catalogRepository === undefined
      ? undefined
      : createCatalogService({
          repository: catalogRepository
        });
  const orderService = createOrderService({
    repository: orderRepository,
    catalogService,
    idGenerator: () => "order-1001",
    invoiceCodeGenerator: () => "INV-20260422-1001",
    clock: () => new Date("2026-04-22T08:00:00.000Z")
  });

  return {
    orderRepository,
    app: createApp({
      authRepository,
      catalogRepository,
      orderService
    })
  };
}

describe("POST /api/orders", () => {
  it("returns order_id, invoice_code, and pending_payment for valid legacy guest payload", async () => {
    const fixture = createOrderApp();

    const response = await request(fixture.app).post("/api/orders").send({
      customer_ref: "12345678:1234",
      product_code: "ml-diamond-86",
      provider: "digiflazz",
      amount_minor: 20_000,
      currency: "idr",
      metadata: {
        source: "web_checkout"
      },
      status: "paid"
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid order payload.",
        details: [
          {
            field: "status",
            message: "status is server-controlled and cannot be provided."
          }
        ]
      }
    });

    const successResponse = await request(fixture.app).post("/api/orders").send({
      customer_ref: "12345678:1234",
      product_code: "ml-diamond-86",
      provider: "digiflazz",
      amount_minor: 20_000,
      currency: "idr",
      metadata: {
        source: "web_checkout"
      }
    });

    expect(successResponse.status).toBe(201);
    expect(successResponse.body).toEqual({
      order_id: "order-1001",
      invoice_code: "INV-20260422-1001",
      status: "pending_payment"
    });

    const persistedOrder = await fixture.orderRepository.findOrderById("order-1001");
    expect(persistedOrder).toMatchObject({
      userId: null,
      productCode: "ml-diamond-86",
      provider: "digiflazz",
      amountMinor: 20_000,
      basePriceSnapshot: null,
      markupSnapshot: null,
      rolePriceSnapshot: null,
      pricingRuleIdSnapshot: null
    });

    const history = fixture.orderRepository.getStatusHistoryByOrderId("order-1001");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      orderId: "order-1001",
      fromStatus: "created",
      toStatus: "pending_payment"
    });
  });

  it("applies pengguna pricing snapshots for guest product-priced orders and ignores tampered amount", async () => {
    const catalogRepository = new InMemoryCatalogRepository({
      products: [product({ id: "product-guest", skuDigiflazz: "ml-diamond-86" })],
      pricingRules: [pricingRule({ id: "pengguna-global", roleType: "pengguna", markupFixed: 2_000, priority: 1 })]
    });
    const fixture = createOrderApp({ catalogRepository });

    const response = await request(fixture.app).post("/api/orders").send({
      customer_ref: "12345678:1234",
      product_id: "product-guest",
      product_code: "tampered-code",
      provider: "tampered-provider",
      amount_minor: 1,
      currency: "IDR",
      metadata: {
        source: "catalog_guest_checkout"
      }
    });

    expect(response.status).toBe(201);

    const persistedOrder = await fixture.orderRepository.findOrderById("order-1001");
    expect(persistedOrder).toMatchObject({
      userId: null,
      productCode: "ml-diamond-86",
      provider: "digiflazz",
      amountMinor: 12_000,
      basePriceSnapshot: 10_000,
      markupSnapshot: 2_000,
      rolePriceSnapshot: 12_000,
      pricingRuleIdSnapshot: "pengguna-global"
    });
  });

  it("stores authenticated seller snapshots and ignores client price tampering", async () => {
    const authRepository = new InMemoryAuthRepository();
    const catalogRepository = new InMemoryCatalogRepository({
      products: [product({ id: "product-seller", skuDigiflazz: "ml-diamond-172" })],
      pricingRules: [
        pricingRule({ id: "seller-global", roleType: "seller", markupFixed: 3_000, priority: 100 }),
        pricingRule({
          id: "seller-product",
          scopeType: "product",
          productId: "product-seller",
          roleType: "seller",
          markupFixed: 500,
          priority: 1
        })
      ]
    });
    const fixture = createOrderApp({ authRepository, catalogRepository });
    const seller = await registerUser(fixture.app, "seller@example.com");

    await authRepository.updateUser(seller.user.id, { role: "seller", updatedAt: createdAt });

    const response = await request(fixture.app)
      .post("/api/orders")
      .set("Authorization", "Bearer " + seller.token)
      .send({
        customer_ref: "12345678:1234",
        product_id: "product-seller",
        product_code: "fake-code",
        provider: "fake-provider",
        amount_minor: 1,
        total_price: 1,
        currency: "IDR",
        metadata: {
          source: "catalog_seller_checkout"
        }
      });

    expect(response.status).toBe(201);

    const persistedOrder = await fixture.orderRepository.findOrderById("order-1001");
    expect(persistedOrder).toMatchObject({
      userId: seller.user.id,
      productCode: "ml-diamond-172",
      provider: "digiflazz",
      amountMinor: 10_500,
      basePriceSnapshot: 10_000,
      markupSnapshot: 500,
      rolePriceSnapshot: 10_500,
      pricingRuleIdSnapshot: "seller-product"
    });
  });

  it("returns unauthorized when a provided bearer token is invalid", async () => {
    const fixture = createOrderApp();

    const response = await request(fixture.app)
      .post("/api/orders")
      .set("Authorization", "Bearer invalid-token")
      .send({
        customer_ref: "12345678:1234",
        product_code: "ml-diamond-86",
        provider: "digiflazz",
        amount_minor: 20_000,
        currency: "IDR",
        metadata: {
          source: "web_checkout"
        }
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required."
      }
    });
  });

  it("rejects inactive catalog products on the product-priced path", async () => {
    const catalogRepository = new InMemoryCatalogRepository({
      products: [product({ id: "inactive-product", isActive: false })]
    });
    const fixture = createOrderApp({ catalogRepository });

    const response = await request(fixture.app).post("/api/orders").send({
      customer_ref: "12345678:1234",
      product_id: "inactive-product",
      product_code: "ignored-code",
      provider: "ignored-provider",
      amount_minor: 1,
      currency: "IDR",
      metadata: {
        source: "catalog_guest_checkout"
      }
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "PRODUCT_INACTIVE",
        message: "Product is inactive."
      }
    });
  });

  it("returns stable validation error for invalid payload", async () => {
    const app = createApp({});

    const response = await request(app).post("/api/orders").send({
      amount_minor: 0,
      metadata: "invalid"
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid order payload.",
        details: [
          {
            field: "amount_minor",
            message: "amount_minor is required and must be a positive integer."
          },
          {
            field: "metadata",
            message: "metadata must be an object when provided."
          }
        ]
      }
    });
  });
});
