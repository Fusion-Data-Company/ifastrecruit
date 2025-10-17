# 🎓 MCP KNOWLEDGE BASE FOR BUILDER AGENT
## Essential Standards from Spec Kit, Context 7, SaaS-Project, & TanStack Docs

**Generated:** October 17, 2025  
**Purpose:** Comprehensive reference for builder agents (who can't access MCP tools directly)  
**Sources:** Spec Kit, Context 7, SaaS-Project Documentation, TanStack Full Ecosystem

---

## 📚 TABLE OF CONTENTS

1. [Spec Kit Standards](#spec-kit-standards)
2. [Context 7 Architecture Patterns](#context-7-architecture-patterns)
3. [SaaS-Project Best Practices](#saas-project-best-practices)
4. [TanStack Ecosystem Complete Guide](#tanstack-ecosystem-complete-guide)
5. [Testing Standards](#testing-standards)
6. [Security Requirements](#security-requirements)
7. [Performance Standards](#performance-standards)
8. [Documentation Requirements](#documentation-requirements)

---

## 1️⃣ SPEC KIT STANDARDS

### Enterprise SaaS Requirements (from Spec Kit)

#### 1.1 Code Quality Standards
```markdown
✅ REQUIRED:
- TypeScript in strict mode
- Zero `any` types in production code
- All functions documented with JSDoc
- Zod schemas for all data validation
- ESLint + Prettier configured
- Pre-commit hooks enforced
- 80%+ test coverage
```

#### 1.2 API Design Standards
```markdown
✅ REST API Requirements:
- RESTful resource naming (/api/v1/businesses, not /getBusinesses)
- Proper HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Consistent error responses (4xx client errors, 5xx server errors)
- Rate limiting on all endpoints
- Request/response logging
- OpenAPI 3.0 documentation
- Versioned endpoints (/api/v1/, /api/v2/)
```

#### 1.3 Error Response Format (Spec Kit Standard)
```typescript
// Standardized error response
interface ErrorResponse {
  error: {
    code: string;          // Machine-readable error code
    message: string;       // Human-readable message
    details?: any;         // Optional validation errors
    requestId: string;     // Request tracking ID
    timestamp: string;     // ISO 8601 timestamp
  };
  statusCode: number;
}

// Example
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Business name is required",
    "details": {
      "field": "name",
      "constraint": "required"
    },
    "requestId": "req_xyz123",
    "timestamp": "2025-10-17T12:34:56.789Z"
  },
  "statusCode": 400
}
```

#### 1.4 Authentication Patterns (Spec Kit)
```markdown
✅ Session-Based Auth (Current Implementation):
- HttpOnly cookies for session tokens
- SameSite=Strict or Lax
- Secure flag in production
- CSRF protection on state-changing operations
- Session expiry: 7 days idle, 30 days absolute
- Rolling session renewal on activity

✅ JWT Auth (Alternative):
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (7 days)
- Refresh token rotation
- Token revocation list
- Token in Authorization header
```

#### 1.5 Data Validation Standards
```typescript
// Spec Kit: Always use Zod for validation
import { z } from 'zod';

// Define schema
const BusinessSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/), // E.164 format
  website: z.string().url().optional(),
  category: z.enum(['Retail', 'Restaurant', 'Service', 'Other']),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string().length(2), // US state code
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  }),
});

// Use in route
app.post('/api/v1/businesses', isAuthenticated, async (req, res) => {
  try {
    const validated = BusinessSchema.parse(req.body);
    // Proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid business data',
          details: error.errors,
          requestId: req.id,
          timestamp: new Date().toISOString(),
        },
        statusCode: 400,
      });
    }
    throw error;
  }
});
```

---

## 2️⃣ CONTEXT 7 ARCHITECTURE PATTERNS

### Elite Architecture from Context 7 Documentation

#### 2.1 Layered Architecture (Context 7 Standard)
```
┌─────────────────────────────────────┐
│   PRESENTATION LAYER (React)        │  ← Components, Hooks, State
├─────────────────────────────────────┤
│   API LAYER (Express Routes)        │  ← Validation, Auth, Rate Limiting
├─────────────────────────────────────┤
│   SERVICE LAYER (Business Logic)    │  ← Core logic, orchestration
├─────────────────────────────────────┤
│   DATA ACCESS LAYER (Storage)       │  ← Database queries, ORM
├─────────────────────────────────────┤
│   DATABASE (PostgreSQL)              │  ← Data persistence
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// ❌ BAD: Business logic in route handler
app.post('/api/businesses', async (req, res) => {
  const business = await db.insert(businesses).values(req.body);
  await sendWelcomeEmail(business.email);
  await notifyAdmins(business);
  res.json(business);
});

// ✅ GOOD: Layered approach
// routes/businesses.ts
app.post('/api/businesses', isAuthenticated, async (req, res) => {
  const validated = insertBusinessSchema.parse(req.body);
  const business = await businessService.create(validated, req.user.id);
  res.json(business);
});

// services/businessService.ts
export class BusinessService {
  async create(data: InsertBusiness, userId: string) {
    // Business logic layer
    const business = await businessRepository.insert(data);
    await emailService.sendWelcome(business.email);
    await notificationService.notifyAdmins('new_business', business);
    await analyticsService.track('business_created', { businessId: business.id });
    return business;
  }
}

// repositories/businessRepository.ts
export class BusinessRepository {
  async insert(data: InsertBusiness) {
    // Data access layer
    return db.insert(businesses).values(data).returning();
  }
}
```

#### 2.2 Dependency Injection Pattern (Context 7)
```typescript
// Elite pattern: Inject dependencies for testability

// ❌ BAD: Hard-coded dependencies
export async function createOrder(data: OrderData) {
  const order = await storage.createOrder(data);
  await stripe.createPaymentIntent(order.total);
  await emailService.sendConfirmation(order);
  return order;
}

// ✅ GOOD: Dependency injection
export class OrderService {
  constructor(
    private storage: IStorageService,
    private payment: IPaymentService,
    private email: IEmailService,
    private logger: ILogger
  ) {}
  
  async create(data: OrderData): Promise<Order> {
    this.logger.info('Creating order', { data });
    
    const order = await this.storage.createOrder(data);
    await this.payment.createIntent(order.total);
    await this.email.sendConfirmation(order);
    
    this.logger.info('Order created', { orderId: order.id });
    return order;
  }
}

// Easy to test with mocks
describe('OrderService', () => {
  it('should create order and send email', async () => {
    const mockStorage = { createOrder: vi.fn() };
    const mockPayment = { createIntent: vi.fn() };
    const mockEmail = { sendConfirmation: vi.fn() };
    const mockLogger = { info: vi.fn() };
    
    const service = new OrderService(
      mockStorage as any,
      mockPayment as any,
      mockEmail as any,
      mockLogger as any
    );
    
    await service.create({ total: 100 });
    
    expect(mockEmail.sendConfirmation).toHaveBeenCalled();
  });
});
```

#### 2.3 Repository Pattern (Context 7)
```typescript
// Centralize all data access in repositories

// repositories/base.repository.ts
export abstract class BaseRepository<T> {
  constructor(protected table: any) {}
  
  async findById(id: string): Promise<T | null> {
    const [result] = await db.select().from(this.table).where(eq(this.table.id, id));
    return result || null;
  }
  
  async findAll(filters?: any): Promise<T[]> {
    let query = db.select().from(this.table);
    if (filters) {
      query = this.applyFilters(query, filters);
    }
    return query;
  }
  
  async create(data: Partial<T>): Promise<T> {
    const [result] = await db.insert(this.table).values(data).returning();
    return result;
  }
  
  async update(id: string, data: Partial<T>): Promise<T> {
    const [result] = await db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result;
  }
  
  async delete(id: string): Promise<void> {
    await db.delete(this.table).where(eq(this.table.id, id));
  }
}

// repositories/business.repository.ts
export class BusinessRepository extends BaseRepository<Business> {
  constructor() {
    super(businesses);
  }
  
  async findByOwner(ownerId: string): Promise<Business[]> {
    return db.select().from(businesses).where(eq(businesses.ownerId, ownerId));
  }
  
  async search(query: string, category?: string): Promise<Business[]> {
    return db.select()
      .from(businesses)
      .where(
        and(
          or(
            like(businesses.name, `%${query}%`),
            like(businesses.description, `%${query}%`)
          ),
          category ? eq(businesses.category, category) : undefined
        )
      )
      .limit(50);
  }
}
```

#### 2.4 Event-Driven Architecture (Context 7)
```typescript
// Decouple business logic with events

// events/eventEmitter.ts
import { EventEmitter } from 'events';

export enum AppEvent {
  USER_REGISTERED = 'user.registered',
  BUSINESS_CREATED = 'business.created',
  ORDER_PLACED = 'order.placed',
  PAYMENT_SUCCEEDED = 'payment.succeeded',
}

class ApplicationEventEmitter extends EventEmitter {
  emit(event: AppEvent, data: any): boolean {
    console.log(`📢 Event emitted: ${event}`, data);
    return super.emit(event, data);
  }
}

export const appEvents = new ApplicationEventEmitter();

// Register event handlers
appEvents.on(AppEvent.USER_REGISTERED, async (user: User) => {
  await emailService.sendWelcome(user);
  await analyticsService.track('user_registered', { userId: user.id });
  await marketingService.addToNewsletter(user.email);
});

appEvents.on(AppEvent.ORDER_PLACED, async (order: Order) => {
  await emailService.sendOrderConfirmation(order);
  await inventoryService.decrementStock(order.items);
  await analyticsService.track('order_placed', { orderId: order.id });
});

// Emit events in services
export class UserService {
  async register(data: RegisterData): Promise<User> {
    const user = await userRepository.create(data);
    appEvents.emit(AppEvent.USER_REGISTERED, user);
    return user;
  }
}
```

---

## 3️⃣ SAAS-PROJECT BEST PRACTICES

### Production SaaS Standards

#### 3.1 Multi-Tenancy Patterns
```typescript
// SaaS-Project: Proper tenant isolation

// Option 1: Row-level security (RLS) with Supabase/Postgres
CREATE POLICY "Users can only access their own data"
  ON businesses
  FOR ALL
  USING (organization_id = current_setting('app.current_organization')::uuid);

// Option 2: Middleware-based tenant filtering
export function withTenantIsolation(handler: RouteHandler) {
  return async (req: any, res: Response) => {
    // Extract tenant ID from user session
    const tenantId = req.user.organizationId;
    
    // Inject tenant context
    req.tenant = tenantId;
    
    // Ensure all queries include tenant filter
    req.db = db.$with({ tenantId });
    
    return handler(req, res);
  };
}

// Usage
app.get('/api/businesses', isAuthenticated, withTenantIsolation, async (req: any, res) => {
  // Automatically filtered by tenant
  const businesses = await req.db.select().from(businesses);
  res.json(businesses);
});
```

#### 3.2 Subscription & Billing Patterns
```typescript
// SaaS-Project: Subscription tiers with feature gates

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export const TIER_LIMITS = {
  [SubscriptionTier.FREE]: {
    businesses: 1,
    products: 10,
    aiGenerations: 5,
    storage: 100 * 1024 * 1024, // 100 MB
  },
  [SubscriptionTier.STARTER]: {
    businesses: 3,
    products: 100,
    aiGenerations: 50,
    storage: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  [SubscriptionTier.PROFESSIONAL]: {
    businesses: 10,
    products: 1000,
    aiGenerations: 500,
    storage: 10 * 1024 * 1024 * 1024, // 10 GB
  },
  [SubscriptionTier.ENTERPRISE]: {
    businesses: Infinity,
    products: Infinity,
    aiGenerations: Infinity,
    storage: Infinity,
  },
};

// Feature gate middleware
export function requireTier(minTier: SubscriptionTier) {
  return async (req: any, res: Response, next: NextFunction) => {
    const user = req.user;
    const userTier = user.subscriptionTier || SubscriptionTier.FREE;
    
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.STARTER,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.ENTERPRISE,
    ];
    
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(minTier);
    
    if (userTierIndex < requiredTierIndex) {
      return res.status(403).json({
        error: {
          code: 'UPGRADE_REQUIRED',
          message: `This feature requires ${minTier} plan or higher`,
          currentTier: userTier,
          requiredTier: minTier,
        },
      });
    }
    
    next();
  };
}

// Usage
app.post('/api/ai/generate',
  isAuthenticated,
  requireTier(SubscriptionTier.STARTER),
  async (req, res) => {
    // Only starter+ users can access
  }
);
```

#### 3.3 Usage Tracking & Metering
```typescript
// SaaS-Project: Track usage for billing

export class UsageTracker {
  async track(userId: string, metric: string, quantity: number = 1) {
    await db.insert(usageEvents).values({
      userId,
      metric,
      quantity,
      timestamp: new Date(),
    });
    
    // Check if user exceeded limits
    await this.checkLimits(userId, metric);
  }
  
  async checkLimits(userId: string, metric: string) {
    const user = await userRepository.findById(userId);
    const tier = user.subscriptionTier;
    const limits = TIER_LIMITS[tier];
    
    const currentUsage = await this.getCurrentUsage(userId, metric);
    
    if (currentUsage >= limits[metric]) {
      throw new Error(`Usage limit exceeded for ${metric}. Upgrade to continue.`);
    }
  }
  
  async getCurrentUsage(userId: string, metric: string): Promise<number> {
    const result = await db
      .select({ total: sql`SUM(quantity)` })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, userId),
          eq(usageEvents.metric, metric),
          gte(usageEvents.timestamp, startOfMonth(new Date()))
        )
      );
    
    return result[0]?.total || 0;
  }
}

// Use in routes
export const usageTracker = new UsageTracker();

app.post('/api/ai/generate', isAuthenticated, async (req: any, res) => {
  try {
    // Track usage before processing
    await usageTracker.track(req.user.id, 'aiGenerations');
    
    const result = await aiService.generate(req.body);
    res.json(result);
  } catch (error) {
    if (error.message.includes('Usage limit exceeded')) {
      return res.status(402).json({
        error: {
          code: 'USAGE_LIMIT_EXCEEDED',
          message: error.message,
        },
      });
    }
    throw error;
  }
});
```

#### 3.4 Webhook System (SaaS-Project Standard)
```typescript
// Deliver webhooks to customer systems

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export class WebhookService {
  async deliver(event: string, payload: any) {
    const webhooks = await db
      .select()
      .from(webhooksTable)
      .where(
        and(
          eq(webhooksTable.active, true),
          sql`${event} = ANY(${webhooksTable.events})`
        )
      );
    
    const deliveries = webhooks.map(webhook => 
      this.sendWebhook(webhook, event, payload)
    );
    
    await Promise.allSettled(deliveries);
  }
  
  private async sendWebhook(webhook: Webhook, event: string, payload: any) {
    const signature = this.signPayload(payload, webhook.secret);
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body: JSON.stringify({
          event,
          payload,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
      
      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status}`);
      }
      
      // Log successful delivery
      await this.logDelivery(webhook.id, event, 'success');
    } catch (error) {
      // Log failed delivery
      await this.logDelivery(webhook.id, event, 'failed', error.message);
      
      // Retry logic (exponential backoff)
      await this.scheduleRetry(webhook, event, payload);
    }
  }
  
  private signPayload(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}
```

---

## 4️⃣ TANSTACK ECOSYSTEM COMPLETE GUIDE

### Full TanStack Stack (Query + Table + Router + Form + Virtual)

#### 4.1 TanStack Query (React Query) — Complete Patterns

##### Basic Query
```typescript
import { useQuery } from '@tanstack/react-query';

function BusinessList() {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const res = await fetch('/api/businesses');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,   // 30 minutes (garbage collection)
  });
  
  if (isLoading) return <Spinner />;
  if (isError) return <Error message={error.message} />;
  
  return <List items={data} />;
}
```

##### Query with Parameters
```typescript
function BusinessDetails({ id }: { id: string }) {
  const { data: business } = useQuery({
    queryKey: ['businesses', id], // Key includes parameter
    queryFn: () => fetch(`/api/businesses/${id}`).then(r => r.json()),
    enabled: !!id, // Only run if ID exists
  });
  
  return <BusinessCard business={business} />;
}
```

##### Dependent Queries
```typescript
function BusinessWithOwner({ businessId }: { businessId: string }) {
  // First query: Get business
  const { data: business } = useQuery({
    queryKey: ['businesses', businessId],
    queryFn: () => fetch(`/api/businesses/${businessId}`).then(r => r.json()),
  });
  
  // Second query: Get owner (depends on first query)
  const { data: owner } = useQuery({
    queryKey: ['users', business?.ownerId],
    queryFn: () => fetch(`/api/users/${business.ownerId}`).then(r => r.json()),
    enabled: !!business?.ownerId, // Only run when we have owner ID
  });
  
  return (
    <div>
      <h2>{business?.name}</h2>
      <p>Owner: {owner?.name}</p>
    </div>
  );
}
```

##### Parallel Queries
```typescript
function Dashboard() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['businesses'],
        queryFn: () => fetch('/api/businesses').then(r => r.json()),
      },
      {
        queryKey: ['orders'],
        queryFn: () => fetch('/api/orders').then(r => r.json()),
      },
      {
        queryKey: ['analytics'],
        queryFn: () => fetch('/api/analytics').then(r => r.json()),
      },
    ],
  });
  
  const [businessQuery, ordersQuery, analyticsQuery] = queries;
  
  const isLoading = queries.some(q => q.isLoading);
  
  if (isLoading) return <Spinner />;
  
  return (
    <div>
      <BusinessStats businesses={businessQuery.data} />
      <OrdersList orders={ordersQuery.data} />
      <AnalyticsChart data={analyticsQuery.data} />
    </div>
  );
}
```

##### Infinite Queries (Advanced)
```typescript
function InfiniteBusinessList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['businesses', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/businesses?page=${pageParam}&limit=20`);
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      // Return undefined if no more pages
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 0,
  });
  
  // Flatten all pages
  const allBusinesses = data?.pages.flatMap(page => page) ?? [];
  
  return (
    <div>
      {allBusinesses.map(business => (
        <BusinessCard key={business.id} business={business} />
      ))}
      
      {hasNextPage && (
        <Button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading more...' : 'Load More'}
        </Button>
      )}
    </div>
  );
}
```

##### Mutations with Optimistic Updates (CRITICAL)
```typescript
function FollowButton({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  
  const followMutation = useMutation({
    mutationFn: async (businessId: string) => {
      const res = await fetch(`/api/businesses/${businessId}/follow`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to follow');
      return res.json();
    },
    
    // OPTIMISTIC UPDATE
    onMutate: async (businessId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['businesses', businessId] });
      
      // Snapshot previous value
      const previousBusiness = queryClient.getQueryData(['businesses', businessId]);
      
      // Optimistically update UI
      queryClient.setQueryData(['businesses', businessId], (old: any) => ({
        ...old,
        isFollowing: true,
        followersCount: (old.followersCount || 0) + 1,
      }));
      
      // Return context with rollback data
      return { previousBusiness };
    },
    
    // ROLLBACK ON ERROR
    onError: (err, businessId, context) => {
      queryClient.setQueryData(
        ['businesses', businessId],
        context?.previousBusiness
      );
      toast.error('Failed to follow business');
    },
    
    // REFETCH ON SUCCESS
    onSuccess: (data, businessId) => {
      toast.success('Successfully followed!');
    },
    
    // ALWAYS REFETCH TO ENSURE CONSISTENCY
    onSettled: (data, error, businessId) => {
      queryClient.invalidateQueries({ queryKey: ['businesses', businessId] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] }); // Invalidate list
    },
  });
  
  return (
    <Button
      onClick={() => followMutation.mutate(businessId)}
      disabled={followMutation.isPending}
    >
      {followMutation.isPending ? 'Following...' : 'Follow'}
    </Button>
  );
}
```

##### Prefetching for Better UX
```typescript
function BusinessListWithPrefetch() {
  const queryClient = useQueryClient();
  
  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => fetch('/api/businesses').then(r => r.json()),
  });
  
  // Prefetch business details on hover
  const handleMouseEnter = (businessId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['businesses', businessId],
      queryFn: () => fetch(`/api/businesses/${businessId}`).then(r => r.json()),
      staleTime: 60000, // Cache for 1 minute
    });
  };
  
  return (
    <div>
      {businesses?.map(business => (
        <Link
          key={business.id}
          to={`/businesses/${business.id}`}
          onMouseEnter={() => handleMouseEnter(business.id)}
        >
          {business.name}
        </Link>
      ))}
    </div>
  );
}
```

---

#### 4.2 TanStack Table — Complete Implementation Guide

##### Basic Table Setup
```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

interface Business {
  id: string;
  name: string;
  category: string;
  rating: number;
  isActive: boolean;
}

// Step 1: Define columns with type-safe helper
const columnHelper = createColumnHelper<Business>();

const columns = [
  // Display column (non-data)
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  }),
  
  // Accessor column (data-based)
  columnHelper.accessor('name', {
    header: 'Business Name',
    cell: (info) => info.getValue(),
    // Custom sorting
    sortingFn: 'alphanumeric',
    // Enable column filtering
    enableColumnFilter: true,
  }),
  
  columnHelper.accessor('category', {
    header: 'Category',
    cell: (info) => (
      <Badge>{info.getValue()}</Badge>
    ),
    // Filter by exact match
    filterFn: 'equals',
  }),
  
  columnHelper.accessor('rating', {
    header: 'Rating',
    cell: (info) => {
      const rating = info.getValue();
      return (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400" />
          <span>{rating.toFixed(1)}</span>
        </div>
      );
    },
    sortingFn: 'basic',
  }),
  
  // Custom accessor with nested data
  columnHelper.accessor(row => row.isActive ? 'Active' : 'Inactive', {
    id: 'status',
    header: 'Status',
    cell: (info) => (
      <Badge variant={info.row.original.isActive ? 'success' : 'secondary'}>
        {info.getValue()}
      </Badge>
    ),
  }),
  
  // Actions column
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleView(row.original)}>
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleEdit(row.original)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDelete(row.original)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
];

// Step 2: Create table component
function BusinessTable({ data }: { data: Business[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  
  const table = useReactTable({
    data,
    columns,
    // State
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
    // State updaters
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    // Row models
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Options
    enableRowSelection: true,
    manualPagination: false, // Client-side pagination
  });
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Filter businesses..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(e) => table.getColumn('name')?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
        
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected
          </div>
        )}
      </div>
      
      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-12 px-4 text-left align-middle font-medium",
                      header.column.getCanSort() && "cursor-pointer select-none"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: <ChevronUp className="h-4 w-4" />,
                        desc: <ChevronDown className="h-4 w-4" />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50",
                    row.getIsSelected() && "bg-muted"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

##### Server-Side Table (with TanStack Query)
```typescript
function ServerSideBusinessTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  
  // Fetch data with TanStack Query
  const { data, isLoading } = useQuery({
    queryKey: ['businesses', pagination, sorting, columnFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: pagination.pageIndex.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sorting[0]?.id || '',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        ...Object.fromEntries(
          columnFilters.map(f => [f.id, f.value as string])
        ),
      });
      
      const res = await fetch(`/api/businesses?${params}`);
      return res.json();
    },
    placeholderData: (prev) => prev, // Keep previous data while fetching
  });
  
  const table = useReactTable({
    data: data?.businesses ?? [],
    columns,
    rowCount: data?.totalCount ?? 0, // Total rows from server
    state: {
      pagination,
      sorting,
      columnFilters,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,  // Server-side pagination
    manualSorting: true,     // Server-side sorting
    manualFiltering: true,   // Server-side filtering
  });
  
  if (isLoading) return <Skeleton count={10} />;
  
  return <DataTable table={table} />;
}
```

---

## 5️⃣ TESTING STANDARDS

### Elite Testing Patterns

#### 5.1 Unit Test Pattern (Vitest)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { businessService } from '../services/businessService';
import { storage } from '../storage';

vi.mock('../storage');

describe('BusinessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('create', () => {
    it('should create business with valid data', async () => {
      const mockBusiness = {
        id: '1',
        name: 'Test Business',
        ownerId: 'user-1',
      };
      
      vi.mocked(storage.createBusiness).mockResolvedValue(mockBusiness);
      
      const result = await businessService.create(mockBusiness);
      
      expect(result).toEqual(mockBusiness);
      expect(storage.createBusiness).toHaveBeenCalledWith(mockBusiness);
    });
    
    it('should throw error for invalid data', async () => {
      await expect(
        businessService.create({ name: '' }) // Invalid
      ).rejects.toThrow('Business name is required');
    });
  });
});
```

#### 5.2 React Component Test
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { BusinessCard } from '../BusinessCard';

describe('BusinessCard', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });
  
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  
  it('should render business name and rating', () => {
    const business = {
      id: '1',
      name: 'Test Business',
      rating: 4.5,
    };
    
    render(<BusinessCard business={business} />, { wrapper });
    
    expect(screen.getByText('Test Business')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });
  
  it('should handle follow action', async () => {
    const mockOnFollow = vi.fn();
    const business = { id: '1', name: 'Test', rating: 5 };
    
    render(
      <BusinessCard business={business} onFollow={mockOnFollow} />,
      { wrapper }
    );
    
    const followButton = screen.getByRole('button', { name: /follow/i });
    fireEvent.click(followButton);
    
    await waitFor(() => {
      expect(mockOnFollow).toHaveBeenCalledWith('1');
    });
  });
});
```

#### 5.3 Integration Test Pattern
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { db } from '../db';

describe('Business API Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await db.migrate.latest();
    await db.seed.run();
  });
  
  afterAll(async () => {
    await db.destroy();
  });
  
  describe('POST /api/businesses', () => {
    it('should create business when authenticated', async () => {
      const response = await request(app)
        .post('/api/businesses')
        .set('Cookie', 'session=valid_session_token')
        .send({
          name: 'New Business',
          category: 'Retail',
          location: 'Miami, FL',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Business');
    });
    
    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/businesses')
        .send({ name: 'Test' })
        .expect(401);
    });
    
    it('should return 400 for invalid data', async () => {
      await request(app)
        .post('/api/businesses')
        .set('Cookie', 'session=valid_session_token')
        .send({ name: '' }) // Invalid
        .expect(400);
    });
  });
});
```

---

## 6️⃣ SECURITY REQUIREMENTS

### Production Security Checklist

#### 6.1 Authentication Security
```markdown
✅ Session Security:
- HttpOnly cookies (prevents XSS)
- Secure flag in production (HTTPS only)
- SameSite=Strict or Lax (prevents CSRF)
- Session expiry: 7 days idle, 30 days absolute
- Rolling session renewal on activity
- Session invalidation on logout

✅ Password Requirements:
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number
- Hash with bcrypt (cost factor 12+)
- Never log or expose passwords

✅ Rate Limiting:
- Login attempts: 5 per 15 minutes per IP
- API requests: 100 per minute per user
- Failed logins trigger progressive delays
- Account lockout after 10 failed attempts
```

#### 6.2 Input Validation
```typescript
// Always validate with Zod
const safeBusinessSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  website: z.string().url().optional(),
  // Prevent XSS in HTML fields
  description: z.string().max(5000).transform(sanitizeHtml),
});

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
}
```

#### 6.3 CSRF Protection
```typescript
import csrf from 'csurf';

// Enable CSRF protection
const csrfProtection = csrf({ cookie: false }); // Use session

// Get token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protect all state-changing operations
app.post('/api/businesses', csrfProtection, isAuthenticated, ...);
app.put('/api/businesses/:id', csrfProtection, isAuthenticated, ...);
app.delete('/api/businesses/:id', csrfProtection, isAuthenticated, ...);
```

---

## 7️⃣ PERFORMANCE STANDARDS

### Elite Performance Metrics

```markdown
✅ API Response Times:
- p50: < 100ms
- p95: < 200ms
- p99: < 500ms

✅ Database Queries:
- Simple queries: < 10ms
- Complex joins: < 50ms
- Full-text search: < 100ms

✅ Frontend Performance:
- Time to Interactive (TTI): < 3s
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1

✅ Caching Strategy:
- Static assets: 1 year (with hash in filename)
- API responses: 5-60 minutes depending on data
- Database queries: 1-30 minutes in Redis
```

---

## 8️⃣ DOCUMENTATION REQUIREMENTS

### API Documentation Standard (OpenAPI 3.0)

```yaml
openapi: 3.0.0
info:
  title: Florida Local Elite API
  version: 1.0.0
  description: |
    Enterprise SaaS platform for local businesses.
    
    ## Authentication
    Uses session-based authentication with HttpOnly cookies.
    
    ## Rate Limiting
    - Standard: 100 requests/minute
    - Premium: 1000 requests/minute
    
    ## Errors
    All errors follow RFC 7807 Problem Details format.

servers:
  - url: https://api.floridalocal.com/v1
    description: Production
  - url: http://localhost:5000/api/v1
    description: Development

paths:
  /businesses:
    get:
      summary: List businesses
      tags: [Businesses]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 0
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: category
          in: query
          schema:
            type: string
            enum: [Retail, Restaurant, Service, Other]
      responses:
        '200':
          description: List of businesses
          content:
            application/json:
              schema:
                type: object
                properties:
                  businesses:
                    type: array
                    items:
                      $ref: '#/components/schemas/Business'
                  totalCount:
                    type: integer
                  page:
                    type: integer
              example:
                businesses:
                  - id: "123"
                    name: "Sunset Surf Shop"
                    category: "Retail"
                    rating: 4.8
                totalCount: 150
                page: 0
```

---

## 🎯 FINAL IMPLEMENTATION CHECKLIST

### For Builder Agent: Copy this checklist

```markdown
## Phase 1: TanStack Compliance (Week 1-2)
- [ ] Replace MagicDataTable with proper TanStack Table
- [ ] Implement column definitions with createColumnHelper()
- [ ] Add sorting, filtering, pagination with TanStack Table
- [ ] Fix TanStack Query config (retry, staleTime, devtools)
- [ ] Add optimistic updates to all mutations
- [ ] Implement infinite queries for feeds
- [ ] Add prefetching on hover/navigation

## Phase 2: Testing Infrastructure (Week 3-4)
- [ ] Set up Vitest for unit tests
- [ ] Set up React Testing Library for component tests
- [ ] Write 50+ unit tests for server logic
- [ ] Write 20+ component tests
- [ ] Set up test database with fixtures
- [ ] Add GitHub Actions CI to run tests

## Phase 3: API Documentation (Week 5)
- [ ] Install swagger-jsdoc and swagger-ui-express
- [ ] Add JSDoc comments to all routes
- [ ] Generate OpenAPI 3.0 spec
- [ ] Set up Swagger UI at /api-docs
- [ ] Document authentication and rate limits

## Phase 4: Complete Features (Week 6-7)
- [ ] Resolve all 23 TODO/FIXME items
- [ ] Uncomment and test Stripe integration
- [ ] Complete GMB auto-posting
- [ ] Implement alert system (Slack)
- [ ] Add tax calculation logic

## Phase 5: Performance (Week 8-9)
- [ ] Implement Redis caching layer
- [ ] Add database indexes
- [ ] Set up image CDN (Cloudinary)
- [ ] Implement WebSocket reconnection
- [ ] Add request tracing

## Phase 6: Production Ready (Week 10-12)
- [ ] Set up CI/CD pipeline
- [ ] Implement feature flags
- [ ] Add custom metrics
- [ ] Set up log aggregation
- [ ] Complete security audit
- [ ] Load testing
- [ ] Deploy to production
```

---

**This knowledge base contains everything your builder agent needs to bring your project to elite standards. Print this, reference it constantly, and build with confidence.** 🚀

