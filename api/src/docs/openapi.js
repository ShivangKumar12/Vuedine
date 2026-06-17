import swaggerJsdoc from 'swagger-jsdoc';

import { config } from '../config/index.js';

/**
 * OpenAPI 3.0 specification for the Vuedine API.
 *
 * The high-level definition (servers, security schemes, shared schemas)
 * lives here. Per-endpoint docs live in JSDoc `@openapi` blocks above each
 * route — single source of truth: the route file IS the doc.
 *
 * Generated:
 *   - At runtime by `swagger-ui-express` (mounted in app.js)
 *   - As a JSON file via `npm run docs:generate` (committed to docs/openapi.json
 *     so PRs reviewing API changes can diff the spec without running anything)
 */

const definition = {
  openapi: '3.0.3',

  info: {
    title: 'Vuedine API',
    version: config.appVersion,
    description: [
      '**Vuedine restaurant POS REST API.**',
      '',
      'All non-public endpoints require a Bearer JWT obtained from `POST /v1/auth/login`. ',
      'Refresh tokens are delivered as `httpOnly` cookies scoped to `/v1/auth`. ',
      'Server-to-server integrations use API keys (`Bearer sk_live_...`); see the API Keys section.',
      '',
      '### Response envelope',
      '',
      'Every response uses a consistent envelope:',
      '',
      '```json',
      '{ "success": true, "data": {...}, "meta": {...}, "error": null, "requestId": "<uuid>" }',
      '```',
      '',
      'Errors flip `success: false`, `data: null`, populate `error.code` + `error.message`, ',
      'and surface a 4xx/5xx HTTP status. The `requestId` is also returned in the ',
      '`X-Request-Id` response header — quote it in support tickets.',
      '',
      '### Rate limiting',
      '',
      'Every public endpoint is rate-limited per IP. When you hit the cap, the response is 429 with the standard envelope and the headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.',
    ].join('\n'),
    contact: { name: 'Vuedine Engineering', email: 'eng@vuedine.com' },
    license: { name: 'Proprietary' },
  },

  servers: [
    { url: 'https://api.vuedine.com', description: 'Production' },
    { url: 'https://staging.api.vuedine.com', description: 'Staging' },
    { url: 'http://localhost:4000', description: 'Local' },
  ],

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'Tenant-issued API key starting with `sk_live_` or `sk_test_`.',
      },
    },

    schemas: {
      Envelope: {
        type: 'object',
        required: ['success', 'data', 'error', 'requestId'],
        properties: {
          success: { type: 'boolean' },
          data: {
            description: 'Endpoint-specific payload (object, array, or null on errors).',
            nullable: true,
          },
          meta: { type: 'object', additionalProperties: true },
          error: {
            nullable: true,
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_CREDENTIALS' },
              message: { type: 'string', example: 'Invalid credentials' },
              details: { type: 'object', additionalProperties: true },
            },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },

      ErrorEnvelope: {
        type: 'object',
        required: ['success', 'data', 'error', 'requestId'],
        properties: {
          success: { type: 'boolean', example: false },
          data: { nullable: true, example: null },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_FAILED' },
              message: { type: 'string', example: 'Request body failed validation' },
              details: { type: 'object', additionalProperties: true },
            },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },

      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 142 },
          totalPages: { type: 'integer', example: 8 },
        },
      },

      User: {
        type: 'object',
        required: ['id', 'email', 'role'],
        properties: {
          id: { type: 'string', example: 'cmq5nztx30006l7tkmw736140' },
          email: { type: 'string', format: 'email', example: 'owner@vuedine.demo' },
          name: { type: 'string', example: 'Demo Owner' },
          role: {
            type: 'string',
            enum: [
              'SUPER_ADMIN',
              'OWNER',
              'ADMIN',
              'MANAGER',
              'CASHIER',
              'WAITER',
              'CHEF',
              'CUSTOMER',
            ],
          },
          tenantId: { type: 'string', nullable: true, example: 'cmq5nztx30000l7tkx9zef0p1' },
          branchIds: { type: 'array', items: { type: 'string' }, example: [] },
        },
      },

      Item: {
        type: 'object',
        required: ['id', 'name', 'category', 'price', 'status'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Margherita Pizza' },
          description: { type: 'string', nullable: true },
          category: { type: 'string', example: 'Pizza' },
          price: { type: 'number', format: 'float', example: 299 },
          status: { type: 'string', enum: ['ACTIVE', 'SOLD_OUT', 'DRAFT'] },
          emoji: { type: 'string', nullable: true, example: '🍕' },
          imageUrl: { type: 'string', nullable: true, format: 'uri' },
          veg: { type: 'boolean', example: true },
          bestseller: { type: 'boolean', example: false },
          branchIds: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Branch: {
        type: 'object',
        required: ['id', 'name', 'code', 'qrSlug'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Mumbai · Bandra (Main)' },
          code: { type: 'string', example: 'BAN' },
          qrSlug: { type: 'string', example: 'bandra' },
          address: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          manager: { type: 'string', nullable: true },
          isLive: { type: 'boolean' },
          timezoneCode: { type: 'string', nullable: true },
          defaultPrep: { type: 'integer', example: 15 },
          serviceCharge: { type: 'number', example: 0 },
          taxInclusive: { type: 'boolean', example: false },
          diningSections: { type: 'array', items: { type: 'string' } },
          openingHours: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Table: {
        type: 'object',
        required: ['id', 'branchId', 'name', 'section', 'capacity', 'shape', 'status'],
        properties: {
          id: { type: 'string' },
          branchId: { type: 'string' },
          name: { type: 'string', example: 'Table 7' },
          section: { type: 'string', example: 'Outdoor · Patio' },
          capacity: { type: 'integer', example: 4 },
          shape: { type: 'string', enum: ['round', 'square', 'rect'] },
          status: { type: 'string', enum: ['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BILL'] },
          active: { type: 'boolean' },
          qrToken: { type: 'string', example: 'aF8gTk2x9LqB' },
          posLabel: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      ApiKey: {
        type: 'object',
        required: ['id', 'name', 'prefix', 'scopes'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'POS hardware integration' },
          prefix: { type: 'string', example: 'sk_live_abc1' },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'orders:read',
                'orders:write',
                'items:read',
                'items:write',
                'payments:read',
                'webhooks:write',
                'reports:read',
              ],
            },
          },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          revokedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'owner@vuedine.demo' },
          password: { type: 'string', format: 'password', example: 'vuedine123' },
          tenantSlug: { type: 'string', example: 'vuedine-demo' },
        },
      },

      LoginResponse: {
        type: 'object',
        required: ['user', 'accessToken'],
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string', example: 'eyJhbGciOi...' },
        },
      },

      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string', nullable: true },
          name: { type: 'string' },
          emoji: { type: 'string', nullable: true },
          qty: { type: 'integer' },
          unitPrice: { type: 'number' },
          lineTotal: { type: 'number' },
          variantId: { type: 'string', nullable: true },
          variantLabel: { type: 'string', nullable: true },
          addons: { type: 'array', items: { type: 'object' } },
          notes: { type: 'string', nullable: true },
          spice: { type: 'integer', nullable: true },
          station: { type: 'string', enum: ['HOT', 'COLD', 'BAR', 'DESSERT'] },
          prepared: { type: 'boolean' },
        },
      },

      Order: {
        type: 'object',
        required: ['id', 'serial', 'token', 'type', 'channel', 'status'],
        properties: {
          id: { type: 'string' },
          serial: { type: 'string', example: 'BAN-1027' },
          token: { type: 'string', example: 'TKN-128' },
          tenantId: { type: 'string' },
          branchId: { type: 'string' },
          sessionId: { type: 'string', nullable: true },
          tableId: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] },
          channel: { type: 'string', enum: ['POS', 'WAITER', 'QR', 'ONLINE'] },
          source: {
            type: 'string',
            enum: ['POS', 'WAITER', 'QR', 'ZOMATO', 'SWIGGY', 'VUEDINE_DIRECT', 'WHATSAPP', 'QR_PAY'],
          },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'ACCEPTED',
              'PREPARING',
              'READY',
              'OUT_FOR_DELIVERY',
              'DELIVERED',
              'SERVED',
              'CANCELLED',
            ],
          },
          priority: { type: 'string', enum: ['NORMAL', 'RUSH'] },
          station: { type: 'string', enum: ['HOT', 'COLD', 'BAR', 'DESSERT'] },
          guestName: { type: 'string', nullable: true },
          guestPhone: { type: 'string', nullable: true },
          tableLabel: { type: 'string', nullable: true },
          subtotal: { type: 'number' },
          discountTotal: { type: 'number' },
          taxTotal: { type: 'number' },
          serviceTotal: { type: 'number' },
          tipTotal: { type: 'number' },
          grandTotal: { type: 'number' },
          paymentMode: { type: 'string', enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'PAY_LATER'] },
          paymentStatus: { type: 'string', enum: ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'] },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      TableSession: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tableId: { type: 'string' },
          status: { type: 'string', enum: ['OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT', 'CLOSED'] },
          partySize: { type: 'integer' },
          guestName: { type: 'string', nullable: true },
          guestPhone: { type: 'string', nullable: true },
          rounds: { type: 'array', items: { type: 'object' } },
          subtotal: { type: 'number' },
          grandTotal: { type: 'number' },
        },
      },

      Payment: {
        type: 'object',
        required: ['id', 'serial', 'method', 'type', 'status', 'amount'],
        properties: {
          id: { type: 'string' },
          serial: { type: 'string', example: 'TXN-BAN-1003' },
          orderId: { type: 'string', nullable: true },
          orderSerial: { type: 'string' },
          method: { type: 'string', example: 'UPI' },
          methodCode: { type: 'string', enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'LOYALTY'] },
          type: { type: 'string', example: 'Sale' },
          typeCode: { type: 'string', enum: ['SALE', 'REFUND', 'TIP', 'COMP', 'SETTLEMENT'] },
          status: { type: 'string', example: 'Success' },
          statusCode: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] },
          amount: { type: 'number' },
          fee: { type: 'number' },
          currency: { type: 'string' },
          cashier: { type: 'string', nullable: true },
          customer: { type: 'string', nullable: true },
          reference: { type: 'string', nullable: true },
          gateway: { type: 'string', nullable: true },
          channel: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Settlement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          gateway: { type: 'string' },
          reference: { type: 'string' },
          grossAmount: { type: 'number' },
          feeAmount: { type: 'number' },
          netAmount: { type: 'number' },
          paymentCount: { type: 'integer' },
          settledAt: { type: 'string', format: 'date-time' },
        },
      },

      PaymentSettings: {
        type: 'object',
        properties: {
          cashEnabled: { type: 'boolean' },
          cardEnabled: { type: 'boolean' },
          upiEnabled: { type: 'boolean' },
          walletEnabled: { type: 'boolean' },
          onlineEnabled: { type: 'boolean' },
          loyaltyEnabled: { type: 'boolean' },
          payOnDeliveryEnabled: { type: 'boolean' },
          gateway: { type: 'string' },
          razorpayKeyId: { type: 'string', nullable: true },
          autoCapture: { type: 'boolean' },
          partialPayments: { type: 'boolean' },
          settlementSchedule: { type: 'string', enum: ['t-0', 't-1', 't-2'] },
          refundPolicy: { type: 'string', enum: ['full', 'partial', 'none'] },
        },
      },
    },

    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      PageSize: {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      Search: {
        name: 'search',
        in: 'query',
        schema: { type: 'string', maxLength: 100 },
      },
    },

    responses: {
      Unauthorized: {
        description: 'Missing or invalid authentication.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
        },
      },
      Forbidden: {
        description: 'Authenticated but insufficient role / scope.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
        },
      },
      NotFound: {
        description: 'Resource not found.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
        },
      },
      ValidationError: {
        description: 'Request body or query failed validation.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
        },
      },
      RateLimited: {
        description: 'Too many requests.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
        },
        headers: {
          'X-RateLimit-Limit': { schema: { type: 'integer' } },
          'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          'X-RateLimit-Reset': { schema: { type: 'integer' } },
          'Retry-After': { schema: { type: 'integer' } },
        },
      },
    },
  },

  // Default security: every endpoint requires Bearer JWT unless overridden.
  // Public endpoints (login / refresh / etc.) set `security: []`.
  security: [{ bearerAuth: [] }],

  tags: [
    { name: 'Auth', description: 'Login, refresh, password reset, current user.' },
    { name: 'Items', description: 'Menu catalog (CRUD per tenant).' },
    { name: 'Branches', description: 'Branches CRUD + qrSlug + dining sections.' },
    { name: 'Tables', description: 'Dining tables + housekeeping status + per-table QR token.' },
    { name: 'Orders', description: 'Order lifecycle — POS, KDS, OSS, public PWA.' },
    { name: 'KDS', description: 'Kitchen Display System — active tickets per station.' },
    { name: 'OSS', description: 'Customer Order Status Screen (public token board).' },
    { name: 'Sessions', description: 'Multi-round table sessions + bill flow.' },
    { name: 'Public', description: 'Customer PWA endpoints (QR scan, menu, place, track).' },
    { name: 'Promotions', description: 'Coupons + Offers engine, apply-coupon, auto-offers.' },
    { name: 'Users', description: 'Staff + customer management, invite flow, roles, shifts.' },
    {
      name: 'API Keys',
      description: 'Tenant-issued bearer keys for server-to-server integrations.',
    },
    { name: 'Payments', description: 'Payments, refunds, comps, settlements, and gateway webhooks.' },
    { name: 'Reports', description: 'Aggregations + KPIs. Lands in Phase 11+.' },
  ],
};

export const openapiSpec = swaggerJsdoc({
  definition,
  // Doc strings live in route files (and occasionally controllers).
  apis: ['src/modules/**/*.routes.js', 'src/modules/**/*.controller.js'],
});
