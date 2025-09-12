# COMPREHENSIVE APPLICATION ANALYSIS
## Generated for GPT-5 Integration Reference

---

## PROMPT 1 - APP STRUCTURE

### Main Application File
- **Primary Entry Point**: `server/index.ts`
  - Initializes Express server
  - Sets up middleware and logging
  - Registers API routes
  - Seeds demo data in development
  - Configures Vite for development/production
  - Serves on port 5000 (default) or PORT env variable

### Frontend Entry Point
- **Client Entry**: `client/src/main.tsx`
  - React application root
  - Renders main App component

### Project Structure Overview
```
root/
├── client/                     # Frontend React App
│   ├── src/
│   │   ├── components/         # UI Components
│   │   │   ├── layout/         # Sidebar.tsx, TopBar.tsx
│   │   │   ├── ui/            # shadcn UI components
│   │   │   └── [specialized]   # DataGrid, PipelineBoard, etc.
│   │   ├── pages/             # Route components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities (queryClient, utils)
│   │   ├── App.tsx            # Main app with routing
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Global styles
│   └── index.html             # HTML template
├── server/                    # Backend Express App
│   ├── integrations/          # External service integrations
│   ├── mcp/                   # Model Context Protocol server
│   ├── middleware/            # Express middleware
│   ├── routes/                # API route handlers
│   ├── services/              # Core backend services
│   ├── index.ts               # Main server entry point
│   ├── routes.ts              # API routing configuration
│   ├── db.ts                  # Database connection
│   └── storage.ts             # Data storage interface
├── shared/                    # Shared code
│   └── schema.ts              # Database schema & types
├── deployment.config.ts       # Environment configurations
├── package.json               # Dependencies
└── vite.config.ts            # Build configuration
```

---

## PROMPT 2 - DATABASE SCHEMA

### Database Models (Drizzle ORM)

#### Candidates Table
```typescript
candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  sourceRef: text("source_ref"),
  resumeUrl: text("resume_url"),
  tags: text("tags").array(),
  pipelineStage: pipelineStageEnum("pipeline_stage").notNull().default("NEW"),
  score: integer("score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailUnique: unique().on(table.email),
}));
```

#### Users Table
```typescript
users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
```

#### Schema Features
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle with Zod validation
- **Insert Schemas**: Auto-generated with `createInsertSchema`
- **Types**: TypeScript types inferred from schema
- **Migrations**: Managed via `npm run db:push`

---

## PROMPT 3 - CURRENT API ENDPOINTS

### Core API Routes

#### Candidate Management
- `GET /api/candidates` - Fetch candidates (paginated)
- `POST /api/candidates` - Create new candidate
- `PATCH /api/candidates/:id` - Update candidate

#### Interview Management
- `GET /api/interviews` - Fetch interviews
- `POST /api/interviews` - Create interview

#### Booking Management
- `GET /api/bookings` - Fetch bookings
- `POST /api/bookings` - Create booking

### Integration APIs


#### Apify Integration
- `GET /api/apify/actors` - Fetch Apify actors
- `POST /api/apify/actors/run` - Run Apify actor
- `GET /api/apify/runs/:actorId` - Get actor runs
- `GET /api/apify/runs/:runId/details` - Get run details
- `GET /api/apify/datasets/:datasetId/items` - Get dataset items
- `POST /api/apify/import` - Import dataset to database

#### Email & Communication
- `POST /api/mailjet/webhooks` - **WEBHOOK ENDPOINT** - Mailjet events

### Utility Endpoints
- `GET /api/health` - Health check
- `GET /api/sse` - Server-Sent Events for real-time updates
- `POST /api/mcp/tools/list` - List MCP tools
- `POST /api/mcp/tools/call` - Call MCP tool
- `GET /api/kpis` - Get KPI metrics

### Public Endpoints
- `GET /interview/:token` - Public interview portal
- `GET /booking/:token` - Public booking portal
- `GET /admin` - Admin stats (protected by query key)

### Object Storage
- `POST /api/objects/upload` - Generate upload URL
- `GET /objects/:objectPath` - Serve stored objects
- `POST /api/objects/acl` - Set object permissions

---

## PROMPT 4 - DEPLOYMENT INFO

### Server Configuration
- **Port**: 5000 (default) or `process.env.PORT`
- **Host**: 0.0.0.0 (binds to all interfaces)
- **Default Public URL**: `https://your-app.replit.app`
- **Webhook Base URL**: `process.env.APP_BASE_URL` or default above

### Environment Configurations

#### Development
- Port: 5000
- CORS: localhost:5000, 127.0.0.1:5000
- Rate Limiting: 10,000 requests/15min
- Database: 5 max connections, no SSL
- Cache: In-memory

#### Staging
- Port: `process.env.PORT` or 5000
- CORS: `process.env.ALLOWED_ORIGINS` or staging domain
- Rate Limiting: 1,000 requests/15min
- Database: 15 max connections, SSL enabled
- Cache: Redis if available, else memory

#### Production
- Port: `process.env.PORT` or 5000
- CORS: `process.env.ALLOWED_ORIGINS` or production domain
- Rate Limiting: 500 requests/15min
- Database: 25 max connections, SSL required
- Cache: Redis required

### Required Environment Variables
#### All Environments
- `DATABASE_URL` (required)

#### Production Only (required)
- `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY`
- `ALLOWED_ORIGINS`
- `SESSION_SECRET`

#### Production Recommended
- `REDIS_URL`
- `MAILJET_API_KEY`
- `SLACK_BOT_TOKEN`
- `APIFY_API_TOKEN`

---

## PROMPT 5 - TECH STACK

### Framework & Language
- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle with Zod validation

### Key Dependencies (package.json)

#### Backend Core
- `express` (4.21.2) - Web framework
- `drizzle-orm` (0.39.1) - Database ORM
- `@neondatabase/serverless` (0.10.4) - Database client
- `zod` (3.24.2) - Schema validation
- `tsx` (4.19.1) - TypeScript execution

#### Frontend Core
- `react` (18.3.1) + `react-dom` (18.3.1)
- `wouter` (3.3.5) - Routing
- `@tanstack/react-query` (5.60.5) - Data fetching
- `@hookform/resolvers` (3.10.0) - Form validation

#### UI Framework
- `tailwindcss` (3.4.17) - CSS framework
- `@radix-ui/*` components - Headless UI primitives
- `lucide-react` (0.453.0) - Icons
- `framer-motion` (11.13.1) - Animations

#### External Integrations
- `@slack/web-api` (7.10.0) - Slack integration
- `apify-client` (2.16.0) - Apify platform
- `node-mailjet` (6.0.9) - Email service
- `@google-cloud/storage` (7.17.0) - Object storage

#### Development Tools
- `vite` (5.4.19) - Build tool
- `typescript` (5.6.3) - Type system
- `drizzle-kit` (0.30.4) - Database migrations
- `@replit/vite-plugin-*` - Replit-specific plugins

### Build Scripts
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production start
- `npm run db:push` - Database migrations

### Project Type
- ES Modules (`"type": "module"`)
- TypeScript throughout
- Modern React with hooks
- RESTful API design
- Real-time updates via SSE

---

## INTEGRATION READINESS

### Database Schema Ready For
✅ **Candidate Storage**: Complete candidate model
✅ **Source Tracking**: `sourceRef` field for tracking application sources
✅ **Pipeline Management**: `pipelineStage` enum for candidate status
✅ **Real-time Updates**: SSE broadcasting for new candidates

### Integration Points Available
✅ **Data Transformation**: Application → Candidate conversion
✅ **Error Handling**: Comprehensive error boundary system
✅ **Monitoring**: Built-in observability and health checks

---

This application is a full-stack TypeScript recruitment platform with Apify integration for data sourcing, ElevenLabs for AI voice agents, and real-time candidate pipeline management with PostgreSQL database backend.