import { z } from "zod";
import { type Request, type Response, type NextFunction } from "express";

// ─── Reusable Primitive Schemas ─────────────────────────────────────

export const zodId = z.string().trim().min(1, "ID is required").max(255);

export const zodEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Must be a valid email address")
  .transform((v) => v.toLowerCase());

export const zodPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const zodPin = z
  .string()
  .regex(/^\d{6}$/, "PIN must be exactly 6 digits");

export const zodPhoneNumber = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[0-9+\-() ]+$/, "Must be a valid phone number")
  .optional();

export const zodName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters")
  .optional();

export const zodPaginationPage = z.coerce
  .number()
  .int()
  .min(1)
  .default(1);

export const zodPaginationLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20);

export const zodSearchQuery = z
  .string()
  .trim()
  .max(200, "Search query too long")
  .optional()
  .default("");

export const zodCustomerNo = z
  .string()
  .trim()
  .min(1, "Customer number is required")
  .max(50, "Customer number too long");

export const zodSkuDigiflazz = z
  .string()
  .trim()
  .min(1, "SKU Digiflazz is required")
  .max(100);

export const zodProductName = z
  .string()
  .trim()
  .min(1, "Product name is required")
  .max(255);

export const zodCategory = z
  .string()
  .trim()
  .min(1, "Category is required")
  .max(100);

export const zodProvider = z
  .string()
  .trim()
  .min(1, "Provider is required")
  .max(100);

export const zodPriceMinor = z
  .number()
  .int()
  .min(0, "Price must be non-negative");

export const zodBoolean = z.boolean();

export const zodMetadata = z.record(z.string(), z.unknown()).optional().default({});

// ─── Auth Schemas ───────────────────────────────────────────────────

export const registerSchema = z.object({
  email: zodEmail,
  password: zodPassword,
  role: z.string().optional()
}).strict();

export const loginSchema = z.object({
  email: zodEmail,
  password: zodPassword
}).strict();

export const updateProfileSchema = z.object({
  name: zodName,
  phone_number: zodPhoneNumber
}).strict();

export const changePinSchema = z.object({
  old_pin: zodPin.optional(),
  new_pin: zodPin
}).strict();

export const verificationTokenSchema = z.object({
  token: z.string().trim().min(1, "Token is required")
}).strict();

// ─── Order Schemas ──────────────────────────────────────────────────

export const createOrderSchema = z.object({
  product_id: z.string().trim().min(1).max(255).nullable().optional(),
  product_code: z.string({
    message: "product_code is required and must be a non-empty string."
  }).trim().min(1, "product_code is required and must be a non-empty string.").max(255).optional(),
  provider: z.string({
    message: "provider is required and must be a non-empty string."
  }).trim().min(1, "provider is required and must be a non-empty string.").max(100).optional(),
  amount_minor: z.number({
    message: "amount_minor is required and must be a positive integer."
  }).int("amount_minor is required and must be a positive integer.").positive("amount_minor is required and must be a positive integer.").optional(),
  currency: z.string().trim().min(1).max(10).toUpperCase().optional().default("IDR"),
  customer_ref: z.string().trim().max(255).nullable().optional().default(null),
  referral_code: z.string().trim().max(50).nullable().optional(),
  discount_code: z.string().trim().max(50).nullable().optional(),
  metadata: z.record(z.string(), z.unknown(), {
    message: "metadata must be an object when provided."
  }).optional().default({}),
  status: z.string().optional()
});

export const createGuestOrderSchema = createOrderSchema;

// ─── Catalog Schemas ────────────────────────────────────────────────

export const catalogQuerySchema = z.object({
  search: zodSearchQuery.optional(),
  page: zodPaginationPage.optional(),
  limit: zodPaginationLimit.optional(),
  category: z.string().trim().max(100).optional(),
  provider: z.string().trim().max(100).optional()
});

export const createProductSchema = z.object({
  sku_digiflazz: zodSkuDigiflazz,
  name: zodProductName,
  category: zodCategory,
  provider: zodProvider.optional().default("digiflazz"),
  base_price_minor: zodPriceMinor,
  is_active: zodBoolean.optional().default(true),
  metadata: zodMetadata
}).strict();

export const updateProductSchema = z.object({
  sku_digiflazz: zodSkuDigiflazz.optional(),
  name: zodProductName.optional(),
  category: zodCategory.optional(),
  provider: zodProvider.optional(),
  base_price_minor: zodPriceMinor.optional(),
  is_active: zodBoolean.optional(),
  metadata: zodMetadata
}).strict();

// ─── Catalog: Pricing Rules ───

export const scopeTypeEnum = z.enum(["global", "category", "product"]);
export const roleTypeEnum = z.enum(["admin", "seller", "pengguna"]);

export const createPricingRuleSchema = z.object({
  scope_type: scopeTypeEnum,
  product_id: z.string().trim().min(1).max(255).nullable().optional(),
  category: z.string().trim().min(1).max(100).nullable().optional(),
  role_type: roleTypeEnum,
  markup_fixed: z.number().int().min(0).default(0),
  markup_percentage: z.number().min(0).default(0),
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
  metadata: zodMetadata.default({}),
}).refine((data) => {
  if (data.scope_type === "global") {
    return (data.product_id === undefined || data.product_id === null) && (data.category === undefined || data.category === null);
  }
  if (data.scope_type === "category") {
    return (data.product_id === undefined || data.product_id === null) && (data.category !== undefined && data.category !== null);
  }
  if (data.scope_type === "product") {
    return (data.product_id !== undefined && data.product_id !== null) && (data.category === undefined || data.category === null);
  }
  return false;
}, {
  message: "Invalid scope: global requires no product_id/category, category requires category only, product requires product_id only"
});

export const updatePricingRuleSchema = z.object({
  scope_type: scopeTypeEnum.optional(),
  product_id: z.string().trim().min(1).max(255).nullable().optional(),
  category: z.string().trim().min(1).max(100).nullable().optional(),
  role_type: roleTypeEnum.optional(),
  markup_fixed: z.number().int().min(0).optional(),
  markup_percentage: z.number().min(0).optional(),
  priority: z.number().int().optional(),
  is_active: z.boolean().optional(),
  metadata: zodMetadata.optional(),
});

// Trusted price: reject if body contains server-controlled fields
const TRUSTED_PRICE_FIELD_NAMES = [
  "final_price", "price", "base_price", "admin_fee",
  "commission", "commission_rate", "markup", "markup_fixed", "markup_percentage"
] as const;

export const trustedPriceBodySchema = z.object({}).catchall(z.unknown()).superRefine(
  (body: Record<string, unknown>, ctx) => {
    const keys = Object.keys(body || {});
    for (const key of keys) {
      if ((TRUSTED_PRICE_FIELD_NAMES as readonly string[]).includes(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is server-controlled and cannot be provided.`
        });
      }
    }
  }
);

export const deleteProductParamsSchema = z.object({
  productId: zodId,
});

// ─── Payment Schemas ────────────────────────────────────────────────

export const initializePaymentSchema = z.object({
  order_id: zodId,
  idempotency_key: z.string().trim().min(1, "Idempotency key is required").max(255)
}).strict();

export const midtransWebhookSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().min(1),
  signature_key: z.string().min(1),
  transaction_status: z.string().min(1),
  transaction_id: z.string().optional(),
  payment_type: z.string().optional(),
  fraud_status: z.string().optional()
}).passthrough();

// ─── Dashboard Schemas ──────────────────────────────────────────────

export const dashboardItemIdSchema = z.object({
  id: zodId
});

export const heroLinkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  image_url: z.string().url().max(500),
  link_url: z.string().url().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
}).strict();

export const promoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  image_url: z.string().url().max(500).optional(),
  badge: z.string().trim().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
}).strict();

export const dashboardCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(100).optional(),
  slug: z.string().trim().max(100).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
});

export const dealSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  image_url: z.string().trim().max(500).optional(),
  product_id: z.string().trim().max(255).optional(),
  discount_label: z.string().trim().max(100).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
});

export const statSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(100).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
});

export const featureSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  icon: z.string().trim().max(100).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: zodBoolean.optional().default(true)
});

// ─── Voucher Schemas ────────────────────────────────────────────────

export const voucherValidateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  amount: z.number().int().positive(),
  product_id: z.string().trim().max(255).optional(),
  base_price: z.number().int().min(0).optional(),
  reseller_price: z.number().int().min(0).optional()
});

export const voucherApplySchema = z.object({
  voucher_code_id: z.string().trim().min(1).max(255),
  order_id: z.string().trim().max(255).optional(),
  user_id: z.string().trim().max(255).optional(),
  discount_amount: z.number().int().min(0),
  original_amount: z.number().int().min(0),
  final_amount: z.number().int().min(0)
});

export const voucherCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  type: z.enum(["affiliate", "admin", "reseller"]),
  created_by: z.string().trim().max(255).optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().min(0),
  max_usage: z.number().int().min(1).optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional(),
  applies_to: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: zodMetadata
});

export const voucherUpdateSchema = z.object({
  type: z.enum(["affiliate", "admin", "reseller"]).optional(),
  discount_type: z.enum(["percentage", "fixed"]).optional(),
  discount_value: z.number().min(0).optional(),
  max_usage: z.number().int().min(1).nullable().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  applies_to: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  is_active: zodBoolean.optional()
});

// ─── Fulfillment Schemas ────────────────────────────────────────────

export const fulfillmentTriggerSchema = z.object({
  order_id: zodId
});

// ─── Admin Schemas ──────────────────────────────────────────────────

export const adminProductUploadSchema = z.object({
  file_base64: z.string().trim().min(1, "file_base64 is required")
}).strict();

// ─── Middleware Helper ──────────────────────────────────────────────

type ZodValidationTarget = "body" | "query" | "params";

export function zodValidate<T extends z.ZodTypeAny>(
  schema: T,
  target: ZodValidationTarget = "body",
  customErrorMessage?: string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || target,
        message: issue.message
      }));

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: customErrorMessage || "Request validation failed.",
          details: issues
        }
      });
      return;
    }

    // Replace raw input with validated + transformed data
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      configurable: true
    });
    next();
  };
}
