# iFast Broker - Enterprise Recruiting Platform

## Overview

iFast Broker is a sophisticated enterprise recruiting platform that combines AI voice agents with automated candidate pipeline management. The application is built exclusively around ElevenLabs agent integration (agent_0601k4t9d82qe5ybsgkngct0zzkm) as the single source of truth for all recruiting data.

The platform is designed as a single-user enterprise solution with real-time capabilities, featuring a modern glassmorphic UI with cyberpunk-inspired design elements. It provides comprehensive candidate management and interview tracking, with all data sourced directly from ElevenLabs conversations and automated processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with custom CSS variables for theming, featuring glassmorphic design patterns
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent, accessible interfaces
- **State Management**: TanStack React Query for server state management with real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Animations**: Framer Motion for micro-interactions and smooth transitions
- **Design System**: Custom enterprise theme with Cinzel font for headings and Inter for body text, featuring blue/teal/cyan color palette

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: Server-Sent Events (SSE) for live updates and WebSocket support
- **API Architecture**: RESTful endpoints with MCP (Model Context Protocol) integration for tool orchestration
- **Build System**: ESBuild for production bundling with development hot-reloading via Vite

### Data Storage
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Data Models**: Campaigns, Candidates, Interviews, Bookings, Apify Actors, and Audit Logs with proper relations
- **Connection Pooling**: Neon serverless connection pooling for optimal performance

### Authentication & Security
- **OpenID Connect Authentication**: Replit Auth integration with Passport.js for secure user authentication
- **Session Management**: PostgreSQL-backed sessions (connect-pg-simple) with secure cookie handling
- **WebSocket Security**: Session-validated WebSocket connections that derive user identity from trusted server-side sessions (FIXED: October 16, 2025 - Eliminated identity spoofing vulnerability)
- **Input Validation**: Zod schemas for request validation and type safety
- **CORS Configuration**: Fastify CORS plugin for cross-origin resource sharing
- **Rate Limiting**: Built-in rate limiting for API protection

#### WebSocket Authentication (Security Fix - October 16, 2025)
The WebSocket messenger service now implements secure session-based authentication:
- **Session Validation on Upgrade**: User identity is extracted from HTTP session cookies during WebSocket upgrade, not from client messages
- **No Client-Supplied Identity**: Client `authenticate` messages are ignored to prevent identity spoofing
- **Secure Identity Derivation**: `ws.userId` is set exclusively from validated PostgreSQL session store data
- **Fail-Secure Design**: WebSocket connections without valid sessions are rejected with HTTP 401
- **Session Parser Utility**: `server/utils/sessionParser.ts` handles cookie extraction and session validation against the PostgreSQL session store

## Recent Changes

### October 17, 2025 - Messenger System Complete Fix
- **Fixed WebSocket Server**: Removed production-only restriction in messenger-websocket.ts so WebSocket server runs in all environments, enabling real-time messaging in development
- **Admin Onboarding Bypass**: Implemented automatic bypass of onboarding survey modal for admin accounts in OnboardingModal.tsx
- **Channel Seeding System**: Created comprehensive channel seeding with three-tier system (non-licensed, FL-licensed, multi-state) and Jason AI welcome messages
- **User-Channel Assignment**: Automated user assignment to channels based on licensing status (hasFloridaLicense, isMultiStateLicensed, isAdmin)
- **Critical Security Fix**: Removed all /api/dev/messenger/* endpoints that allowed unauthenticated access - now all messenger access requires proper authentication
- **Test User System**: Added three test users with different licensing tiers (test-nonlicensed@, test-florida@, test-multistate@ifast.recruit) for development testing
- **Database Seeding**: Created seed-full.ts script to populate database with channels, test users, and proper assignments

## External Dependencies

### AI & Voice Services
- **ElevenLabs**: Voice agent integration for conducting automated interviews and candidate interactions
- **OpenRouter**: LLM routing service supporting multiple AI models (Claude 3.5 Sonnet, GPT-4 Turbo, GPT-3.5 Turbo) with different profiles for orchestration, research, and fast responses

### Automation & Browser Services
- **Airtop**: Browser automation service for advanced workflow automation (available but needs configuration)

### Communication & Collaboration  
- **Mailjet**: Transactional email service for interview invitations, booking confirmations, and candidate communications

### Calendar & Scheduling
- **FullCalendar**: Interactive calendar components for interview scheduling
- **ical-generator**: iCalendar file generation for calendar integration and meeting invites

### Development & Monitoring
- **Model Context Protocol (MCP)**: Tool orchestration and workflow automation framework
- **WebSocket Server**: Real-time bidirectional communication for live updates
- **Replit Integration**: Development environment optimization with error handling and live reloading