import express, { type Request } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { InMemoryAuthRepository, SupabaseAuthRepository, type AuthRepository } from "./modules/auth/auth.repository";
import { createAuthenticationMiddleware, requireRoles } from "./modules/auth/auth.middleware";
import { createAuthRouter } from "./modules/auth/auth.router";
import { createAuthService, type AuthService, type EmailVerificationSender } from "./modules/auth/auth.service";
import { createAccountRouter } from "./modules/account/account.router";
import { createAccountService, type AccountService } from "./modules/account/account.service";
import { createAdminRouter } from "./modules/admin/admin.router";
import { createAdminService, type AdminService } from "./modules/admin/admin.service";
import { createProductUploadService } from "./modules/admin/product-upload.service";
import { createAdminMonitoringRouter, createMemberTransactionsRouter } from "./modules/dashboard/dashboard.router";
import { createDashboardService, type DashboardService } from "./modules/dashboard/dashboard.service";
import { createAdminDigiflazzOperationsRouter } from "./modules/dashboard/digiflazz-operations.router";
import { createDashboardContentRouter } from "./routes/dashboard.router";
import { SupabaseDashboardContentRepository } from "./modules/dashboard/dashboard-content.repository";
import voucherRouter from "./routes/voucher.router";
import orderRouter from "./routes/order.router";
import { createAdminAuditRouter, createProviderAuditRouter } from "./modules/audit/provider-audit.router";
import { InMemoryProviderAuditRepository, SupabaseProviderAuditRepository } from "./modules/audit/provider-audit.repository";
import { type ProviderAuditRepository } from "./modules/audit/provider-audit.types";
import { InMemoryCommissionRepository, SupabaseCommissionRepository } from "./modules/commission/commission.repository";
import { type CommissionRepository } from "./modules/commission/commission.types";
import { createAdminCommissionRouter, createCommissionRouter } from "./modules/commission/commission.router";
import { createCommissionService, type CommissionService } from "./modules/commission/commission.service";
import {
  InMemoryOrderRepository,
  SupabaseOrderRepository,
  type OrderRepository
} from "./modules/order/order.repository";
import { createOrdersRouter } from "./modules/order/order.router";
import { createOrderService, type OrderService } from "./modules/order/order.service";
import { InMemoryPaymentRepository, SupabasePaymentRepository, type PaymentRepository } from "./modules/payment/payment.repository";
import {
  InMemoryFulfillmentRepository,
  SupabaseFulfillmentRepository,
  type FulfillmentRepository
} from "./modules/fulfillment/fulfillment.repository";
import { createFulfillmentRouter } from "./modules/fulfillment/fulfillment.router";
import { createFulfillmentService, type FulfillmentService } from "./modules/fulfillment/fulfillment.service";
import { createPaymentRouter } from "./modules/payment/payment.router";
import { createPaymentService, type PaymentService } from "./modules/payment/payment.service";
import { createInvoiceStatusRouter } from "./modules/invoice-status/invoice-status.router";
import { createInvoiceStatusService, type InvoiceStatusService } from "./modules/invoice-status/invoice-status.service";
import { InMemoryCatalogRepository, SupabaseCatalogRepository, type CatalogRepository } from "./modules/catalog/catalog.repository";
import { MySqlCatalogRepository } from "./modules/catalog/mysql-catalog.repository";
import mysql from "mysql2/promise";
import { createCatalogAdminRouter, createCatalogRouter } from "./modules/catalog/catalog.router";
import { createDigiflazzPriceListSyncService, type DigiflazzPriceListSyncService } from "./modules/catalog/digiflazz-price-sync.service";
import { createCatalogService, type CatalogService } from "./modules/catalog/pricing.service";
import { ProductCacheService } from "./modules/catalog/product-cache.service";
import { InMemoryPostpaidRepository, SupabasePostpaidRepository, type PostpaidRepository } from "./modules/postpaid/postpaid.repository";
import { createPostpaidRouter } from "./modules/postpaid/postpaid.router";
import { createPostpaidService, type PostpaidService } from "./modules/postpaid/postpaid.service";
import { InMemoryPayoutRepository, SupabasePayoutRepository, type PayoutRepository } from "./modules/payout/payout.repository";
import { createPayoutService, type PayoutService } from "./modules/payout/payout.service";
import { createPayoutRouter } from "./modules/payout/payout.router";
import { createEncryptionService } from "./security/encryption.service";
import { type AuditLogger } from "./security/audit";
import { createRateLimitMiddleware } from "./security/rate-limit";

export type MidtransConfig = Readonly<{
  clientKey: string;
  serverKey: string;
  apiBaseUrl: string;
  merchantId: string;
}>;

export type DigiflazzConfig = Readonly<{
  username: string | null;
  apiKey: string | null;
  apiBaseUrl: string;
  webhookSecret: string | null;
  nodeEnv: "development" | "test" | "production";
  topupOptions?: Readonly<{
    testing?: boolean;
    maxPrice?: number;
    callbackUrl?: string;
    allowDot?: boolean;
  }>;
}>;

export type AppDependencies = Readonly<{
  authRepository?: AuthRepository;
  authService?: AuthService;
  emailVerificationSender?: EmailVerificationSender;
  accountService?: AccountService;
  adminService?: AdminService;
  dashboardService?: DashboardService;
  orderRepository?: OrderRepository;
  orderService?: OrderService;
  paymentRepository?: PaymentRepository;
  paymentService?: PaymentService;
  fulfillmentRepository?: FulfillmentRepository;
  fulfillmentService?: FulfillmentService;
  catalogRepository?: CatalogRepository;
  catalogService?: CatalogService;
  postpaidRepository?: PostpaidRepository;
  postpaidService?: PostpaidService;
  providerAuditRepository?: ProviderAuditRepository;
  commissionRepository?: CommissionRepository;
  commissionService?: CommissionService;
  payoutRepository?: PayoutRepository;
  payoutService?: PayoutService;
  auditLogger?: AuditLogger;
  rateLimit?: Readonly<{ windowMs: number; maxRequests: number }>;
  supabaseConfig?: Readonly<{ url: string; serviceRoleKey: string; tablePrefix?: string }>;
  authConfig?: Readonly<{ jwtSecret: string; jwtExpiresIn: string; passwordHashCost: number }>;
  midtransConfig?: MidtransConfig;
  digiflazzConfig?: DigiflazzConfig;
  encryptionConfig?: Readonly<{ encryptionKey: string }>;
  fetchImpl?: typeof fetch;
}>;

export function createApp(dependencies: AppDependencies) {
  const app = express();

  // Trust proxy for reverse proxy rate-limiting
  app.set("trust proxy", true);

  // Helmet security headers
  app.use(helmet());

  // CORS config
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "https://demo.hanzserver.online"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  // Rate Limiting — disabled in test environment to prevent cross-test interference
  if (process.env.NODE_ENV !== "test") {
    const globalLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      validate: { trustProxy: false },
      message: { success: false, message: "Terlalu banyak request. Silakan coba lagi dalam 1 menit." }
    });

    app.use("/api/", globalLimiter);

    const catalogLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      validate: { trustProxy: false },
      message: { success: false, message: "Terlalu banyak pencarian produk. Silakan coba lagi dalam 1 menit." }
    });
    app.use("/api/catalog/", catalogLimiter);
  }

  const tablePrefix = dependencies.supabaseConfig?.tablePrefix ?? "";

  // 1. Audit & Ledger
  const providerAuditRepository = dependencies.providerAuditRepository ?? (
    dependencies.supabaseConfig
      ? new SupabaseProviderAuditRepository(
          dependencies.supabaseConfig.url,
          dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        )
      : new InMemoryProviderAuditRepository()
  );

  // 2. Commission & Affiliate
  const commissionRepository = dependencies.commissionRepository ?? (
    dependencies.supabaseConfig
      ? new SupabaseCommissionRepository(
          dependencies.supabaseConfig.url,
          dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        )
      : new InMemoryCommissionRepository()
  );
  const commissionService = dependencies.commissionService ?? createCommissionService({ repository: commissionRepository });

  // 3. Auth
  const authRepository = dependencies.authRepository ?? (
    dependencies.supabaseConfig
      ? new SupabaseAuthRepository({
          supabaseUrl: dependencies.supabaseConfig.url,
          supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        })
      : new InMemoryAuthRepository()
  );
  const authService = dependencies.authService ?? createAuthService({ 
    repository: authRepository,
    jwtSecret: dependencies.authConfig?.jwtSecret ?? "test-only-jwt-secret-at-least-32-bytes",
    jwtExpiresIn: dependencies.authConfig?.jwtExpiresIn ?? "1h",
    passwordHashCost: dependencies.authConfig?.passwordHashCost ?? 4,
    emailVerificationSender: dependencies.emailVerificationSender,
    clock: dependencies.authService ? undefined : (global as any).authClock
  });

  // 4. Account & Admin
  const accountService = dependencies.accountService ?? createAccountService({ repository: authRepository });
  const adminService = dependencies.adminService ?? createAdminService({ repository: authRepository });

  // 5. Catalog & Products
  const supabaseFallbackRepository = dependencies.supabaseConfig
    ? new SupabaseCatalogRepository({
        supabaseUrl: dependencies.supabaseConfig.url,
        supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
        tablePrefix
      })
    : new InMemoryCatalogRepository();

  const catalogRepository = dependencies.catalogRepository ?? (
    process.env.MYSQL_HOST
      ? new MySqlCatalogRepository({
          pool: mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10
          }),
          supabaseFallback: supabaseFallbackRepository
        })
      : supabaseFallbackRepository
  );
  const productUploadService = createProductUploadService(catalogRepository);

  // Dashboard Content Repository
  const dashboardContentRepository = dependencies.supabaseConfig
    ? new SupabaseDashboardContentRepository({
        supabaseUrl: dependencies.supabaseConfig.url,
        supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
        tablePrefix
      })
    : null;

  const priceListSyncService = createDigiflazzPriceListSyncService({
    repository: catalogRepository,
    digiflazzConfig: dependencies.digiflazzConfig ? {
      username: dependencies.digiflazzConfig.username,
      apiKey: dependencies.digiflazzConfig.apiKey,
      apiBaseUrl: dependencies.digiflazzConfig.apiBaseUrl
    } : { 
      username: null, apiKey: null, apiBaseUrl: "" 
    },
    fetchImpl: dependencies.fetchImpl
  });

  const catalogService = dependencies.catalogService ?? createCatalogService({ 
    repository: catalogRepository,
    priceListSyncService
  });

  // Product Cache Service
  const productCache = new ProductCacheService(catalogService);

  // 6. Orders
  const orderRepository = dependencies.orderRepository ?? (
    dependencies.supabaseConfig
      ? new SupabaseOrderRepository({
          supabaseUrl: dependencies.supabaseConfig.url,
          supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        })
      : new InMemoryOrderRepository()
  );
  const orderService = dependencies.orderService ?? createOrderService({ 
    repository: orderRepository,
    catalogService,
    commissionService
  });

  // 8. Fulfillments
  const fulfillmentRepository = dependencies.fulfillmentRepository ?? (
    dependencies.supabaseConfig
      ? new SupabaseFulfillmentRepository({
          supabaseUrl: dependencies.supabaseConfig.url,
          supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        })
      : new InMemoryFulfillmentRepository(orderRepository)
  );
  const fulfillmentService = dependencies.fulfillmentService ?? createFulfillmentService({
    fulfillmentRepository,
    orderService,
    commissionService,
    digiflazzConfig: dependencies.digiflazzConfig ?? { 
      username: null, apiKey: null, apiBaseUrl: "", webhookSecret: null, nodeEnv: "development" 
    },
    providerAuditRepository,
    fetchImpl: dependencies.fetchImpl
  });

  // 7. Payments
  const paymentRepository = dependencies.paymentRepository ?? (
    dependencies.supabaseConfig
      ? new SupabasePaymentRepository({
          supabaseUrl: dependencies.supabaseConfig.url,
          supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        })
      : new InMemoryPaymentRepository(orderRepository)
  );
  const paymentService = dependencies.paymentService ?? createPaymentService({
    paymentRepository,
    orderService,
    commissionService,
    fulfillmentService,
    midtransConfig: dependencies.midtransConfig ?? { 
      clientKey: "", serverKey: "", apiBaseUrl: "", merchantId: "" 
    },
    providerAuditRepository,
    fetchImpl: dependencies.fetchImpl
  });

  // 9. Postpaid
  const postpaidRepository = dependencies.postpaidRepository ?? (
    dependencies.supabaseConfig
      ? new SupabasePostpaidRepository({
          supabaseUrl: dependencies.supabaseConfig.url,
          supabaseServiceRoleKey: dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        })
      : new InMemoryPostpaidRepository()
  );
  const postpaidService = dependencies.postpaidService ?? createPostpaidService({
    repository: postpaidRepository,
    digiflazzConfig: dependencies.digiflazzConfig ?? { 
      username: null, apiKey: null, apiBaseUrl: "", webhookSecret: null, nodeEnv: "development" 
    },
    fetchImpl: dependencies.fetchImpl
  });

  // 10. Payout
  const payoutRepository = dependencies.payoutRepository ?? (
    dependencies.supabaseConfig
      ? new SupabasePayoutRepository(
          dependencies.supabaseConfig.url,
          dependencies.supabaseConfig.serviceRoleKey,
          tablePrefix
        )
      : new InMemoryPayoutRepository()
  );
  const encryptionService = createEncryptionService({
    encryptionKey: dependencies.encryptionConfig?.encryptionKey ?? "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=="
  });
  const payoutService = dependencies.payoutService ?? createPayoutService({
    repository: payoutRepository,
    encryption: encryptionService
  });

  // 11. Dashboard
  const dashboardService = dependencies.dashboardService ?? createDashboardService({
    orderRepository,
    paymentRepository,
    fulfillmentRepository
  });

  // 11. Invoice Status
  const invoiceStatusService = createInvoiceStatusService({
    orderRepository,
    paymentRepository,
    fulfillmentRepository
  });

  const authenticationMiddleware = createAuthenticationMiddleware(authService);
  const adminOnlyMiddleware = requireRoles(["admin"]);

  const sensitiveEndpointRateLimit = createRateLimitMiddleware({
    windowMs: dependencies.rateLimit?.windowMs ?? 60_000,
    maxRequests: dependencies.rateLimit?.maxRequests ?? 60,
    auditLogger: dependencies.auditLogger
  });

  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    }
  }));

  const apiPaths = ["", "/ppob-api"];

  for (const path of apiPaths) {
    const fullPath = (p: string) => path + p;

    app.use(fullPath("/api/auth"), createAuthRouter({ authService }));
    app.use(fullPath("/api/account/transactions"), authenticationMiddleware, createMemberTransactionsRouter({ dashboardService }));
    app.use(fullPath("/api/account/audit"), authenticationMiddleware, createProviderAuditRouter({ repository: providerAuditRepository }));
    app.use(fullPath("/api/account/commission"), authenticationMiddleware, createCommissionRouter({ commissionService, repository: commissionRepository }));
    app.use(fullPath("/api/account"), authenticationMiddleware, createAccountRouter({ accountService }));
    
    app.use(fullPath("/api/admin/monitoring"), authenticationMiddleware, adminOnlyMiddleware, createAdminMonitoringRouter({ dashboardService }));
    app.use(fullPath("/api/admin/catalog"), authenticationMiddleware, adminOnlyMiddleware, createCatalogAdminRouter({ catalogService }));
    app.use(fullPath("/api/admin/audit"), authenticationMiddleware, adminOnlyMiddleware, createAdminAuditRouter({ repository: providerAuditRepository }));
    app.use(fullPath("/api/admin/commission"), authenticationMiddleware, adminOnlyMiddleware, createAdminCommissionRouter({ repository: commissionRepository }));
    app.use(fullPath("/api/admin/digiflazz/operations"), authenticationMiddleware, adminOnlyMiddleware, createAdminDigiflazzOperationsRouter({ 
      catalogRepository, 
      paymentRepository, 
      digiflazzConfig: dependencies.digiflazzConfig ? {
        username: dependencies.digiflazzConfig.username,
        apiKey: dependencies.digiflazzConfig.apiKey,
        apiBaseUrl: dependencies.digiflazzConfig.apiBaseUrl
      } : { 
        username: null, apiKey: null, apiBaseUrl: "" 
      }, 
      fetchImpl: dependencies.fetchImpl 
    }));
    app.use(fullPath("/api/admin"), authenticationMiddleware, adminOnlyMiddleware, createAdminRouter({ adminService, productUploadService }));

    app.use(fullPath("/api/catalog"), createCatalogRouter({ catalogService, authService }, productCache));
    if (dashboardContentRepository) {
      app.use(fullPath("/api/dashboard"), createDashboardContentRouter({ 
        repository: dashboardContentRepository, 
        authService 
      }));
    }
    app.use(fullPath("/api/orders"), createOrdersRouter({ orderService, authService, orderRepository }));
    app.use(fullPath("/api/orders"), orderRouter);
    app.use(fullPath("/api/payments"), sensitiveEndpointRateLimit, createPaymentRouter({ 
      paymentService,
      auditLogger: dependencies.auditLogger
    }));
    app.use(fullPath("/api/fulfillments"), sensitiveEndpointRateLimit, createFulfillmentRouter({ 
      fulfillmentService,
      digiflazzWebhookSecret: dependencies.digiflazzConfig?.webhookSecret ?? null,
      auditLogger: dependencies.auditLogger
    }));
    app.use(fullPath("/api/webhook"), sensitiveEndpointRateLimit, createFulfillmentRouter({ 
      fulfillmentService,
      digiflazzWebhookSecret: dependencies.digiflazzConfig?.webhookSecret ?? null,
      auditLogger: dependencies.auditLogger
    }));
    app.use(fullPath("/api/digiflazz"), authenticationMiddleware, createPostpaidRouter({ postpaidService }));
    app.use(fullPath("/api/payout"), authenticationMiddleware, createPayoutRouter({ payoutService }));
    app.use(fullPath("/api/invoices"), createInvoiceStatusRouter({ invoiceStatusService }));
    app.use(fullPath("/api/vouchers"), voucherRouter);

    app.get(fullPath("/health"), (_req, res) => {
      res.json({ status: "ok" });
    });
    app.get(fullPath("/api/health"), (_req, res) => {
      res.json({ status: "ok" });
    });
  }

  return app;
}
