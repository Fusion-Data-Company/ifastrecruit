# iFast Enterprise Collaboration Platform - Slack-Grade System

## Overview

iFast is an ultra-elite enterprise collaboration platform comparable to Slack in functionality and architecture. Originally a recruiting platform, it has been completely transformed into a comprehensive enterprise communication and workflow automation system with multi-tenant architecture, real-time messaging, and advanced collaboration features.

The platform features a modern glassmorphic UI with cyberpunk-inspired design elements, providing enterprise-grade communication, workflow automation, and team collaboration capabilities that rival industry leaders like Slack, Microsoft Teams, and Discord.

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

### October 17, 2025 - Complete Enterprise Transformation to Slack-Grade Platform
- **Platform Transformation**: Successfully transformed recruitment platform into comprehensive Slack-like enterprise collaboration system
- **Multi-Tenant Architecture**: Implemented workspace/organization structure with complete data isolation across all tables
- **Service Layer Pattern**: Refactored entire backend to use dependency injection with IoC container and service classes
- **Repository Pattern**: Created repository layer for all database operations with proper abstraction
- **Event-Driven Architecture**: Built event bus system for decoupled service communication
- **Advanced Messaging**: Added message editing, deletion, reactions, threads, rich text formatting
- **Voice/Video Calls**: Implemented WebRTC infrastructure for calls with screen sharing and huddles
- **Channel Management**: Created private channels, channel permissions, discovery, and shared channels
- **Slash Commands**: Built command palette system with extensible slash commands (Ctrl/Cmd+K)
- **App Integration Framework**: Developed webhook system, OAuth apps, and bot framework
- **Advanced Search**: Implemented full-text search with filters, operators, and saved searches
- **Workflow Automation**: Created visual workflow builder with React Flow for triggers and actions
- **Enterprise Security**: Added SSO/SAML, 2FA with TOTP/SMS, audit logging, and compliance features
- **API Versioning**: Implemented versioned API endpoints with deprecation strategy
- **Comprehensive Testing**: Created complete testing suite with unit tests, integration tests, and E2E tests
- **Bug Fixes**: Fixed null pointer exceptions in messenger by adding proper null checks for message arrays

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