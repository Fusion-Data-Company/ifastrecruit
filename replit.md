# iFast Broker - Enterprise Recruiting Platform

## Overview

iFast Broker is a sophisticated enterprise recruiting platform that combines AI voice agents with automated candidate pipeline management. The application integrates multiple external services including ElevenLabs for voice agents, Indeed/Apify for job sourcing, Slack for team collaboration, and various other tools to create a comprehensive recruiting workflow automation system.

The platform is designed as a single-user enterprise solution with real-time capabilities, featuring a modern glassmorphic UI with cyberpunk-inspired design elements. It provides end-to-end recruiting functionality from job posting and candidate sourcing to interview scheduling and team onboarding.

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
- **Token-based Authentication**: Secure token generation using crypto.randomBytes
- **Input Validation**: Zod schemas for request validation and type safety
- **CORS Configuration**: Fastify CORS plugin for cross-origin resource sharing
- **Rate Limiting**: Built-in rate limiting for API protection

## External Dependencies

### AI & Voice Services
- **ElevenLabs**: Voice agent integration for conducting automated interviews and candidate interactions
- **OpenRouter**: LLM routing service supporting multiple AI models (Claude 3.5 Sonnet, GPT-4 Turbo, GPT-3.5 Turbo) with different profiles for orchestration, research, and fast responses

### Job Sourcing & Automation
- **Indeed API**: Job posting and applicant management integration
- **Apify**: Web scraping and automation platform for candidate sourcing from various job sites
- **Airtop**: Browser automation service serving as fallback for Indeed and Apify operations when primary APIs fail

### Communication & Collaboration
- **Slack Web API**: Team collaboration with automated candidate pool management and notifications
- **Mailjet**: Transactional email service for interview invitations, booking confirmations, and candidate communications

### Calendar & Scheduling
- **FullCalendar**: Interactive calendar components for interview scheduling
- **ical-generator**: iCalendar file generation for calendar integration and meeting invites

### Development & Monitoring
- **Model Context Protocol (MCP)**: Tool orchestration and workflow automation framework
- **WebSocket Server**: Real-time bidirectional communication for live updates
- **Replit Integration**: Development environment optimization with error handling and live reloading