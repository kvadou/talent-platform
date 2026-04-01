# Talent Platform

A full-featured Applicant Tracking System (ATS) built with Next.js 14. Manages the complete hiring pipeline from job posting through offer acceptance, with AI-powered candidate matching, interview scheduling, e-signatures, and background checks.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with pgvector (vector similarity search)
- **ORM**: Prisma 5
- **Auth**: Clerk
- **UI**: Tailwind CSS, Headless UI, Heroicons, TipTap (rich text), Recharts
- **AI**: OpenAI (embeddings, scoring, keyword expansion)
- **Integrations**: Zoom, Checkr, Dropbox Sign, Postmark, Twilio, Google Calendar, AWS S3

## Architecture

```
src/
  app/
    (auth)/          # Auth pages (login, error, unauthorized)
    (dashboard)/     # Protected ATS dashboard
    (public)/        # Public career site, job board, candidate portal
      careers/       # Branded career landing page
      jobs/          # Job listings + application flow
      schedule/      # Candidate self-scheduling
      meet/          # Scheduling link booking pages
      status/        # Candidate application status portal
    api/             # API routes
      candidates/    # CRUD, resume upload, embeddings, bulk ops
      scheduling-links/ # Self-scheduling link management
      offers/        # Offer management
      webhooks/      # Checkr, Dropbox Sign, E-Sign, Zoom webhooks
  components/        # React components (19 modules)
  hooks/             # Custom React hooks
  lib/               # Service layer
    automation/      # Pipeline automation rules engine
    email-templates/ # Branded HTML email templates
    integrations/    # Third-party integration configs
    notifications/   # Multi-channel notification dispatchers
    pipeline/        # Hiring pipeline state machine
    search/          # Full-text + vector similarity search
    security/        # Encryption, RBAC, API auth middleware
    validation/      # Zod schemas
prisma/
  schema.prisma      # Database schema (~75 models)
  seed.ts            # Demo data seeder
  migrations/        # Migration history
```

## Key Features

- **Multi-market hiring**: Role-based access control with HQ Admin, Market Admin, and Recruiter roles scoped to geographic markets
- **AI candidate scoring**: Resume parsing (PDF/text), OpenAI embedding generation, semantic job matching via pgvector cosine similarity
- **Interview scheduling**: Zoom meeting creation with S2S OAuth, Google Calendar sync, candidate self-scheduling with buffer times
- **Pipeline automation**: Configurable stage rules with triggers (onEnter, onExit, onSlaBreach) and actions (email, SMS, task, tag)
- **E-signatures**: Offer letter generation and signing via Dropbox Sign or internal E-Sign platform with webhook-driven status updates
- **Background checks**: Checkr integration with candidate invitation flow and webhook-driven report tracking
- **Email sequences**: Multi-step drip campaigns with merge fields, delays, and cancel-on-reply
- **Public career site**: Branded job board with rich job descriptions and embedded application flow
- **Candidate portal**: Real-time status tracking, interview management, document signing

## Getting Started

### Prerequisites

- Node.js 18.x
- PostgreSQL 15+ with [pgvector extension](https://github.com/pgvector/pgvector)
- A [Clerk](https://clerk.com) dev instance (free tier works)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values (see below for what's required)

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed demo data
npm run seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.example` for the complete list. At minimum you need:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk auth |
| `CLERK_SECRET_KEY` | Yes | Clerk auth |
| `JWT_SECRET` | Yes | Token encryption |
| `NEXT_PUBLIC_APP_URL` | Yes | App base URL |

All external integrations (Zoom, Checkr, Dropbox Sign, Postmark, Twilio, OpenAI, S3) have **stub guards** -- the app runs without any of these API keys. When an integration's env vars aren't set, the service returns mock data and logs to the console.

### Demo Credentials (after seeding)

| Role | Email |
|------|-------|
| HQ Admin | hq.admin@acmetalent.com |
| Market Admin | eastside.admin@acmetalent.com |
| Recruiter | recruiter@acmetalent.com |

> Auth is handled by Clerk, so you'll need a Clerk dev instance configured. The seeded users populate the RBAC system.

## Scripts

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Lint code
npm run seed             # Seed demo data
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run Prisma migrations
npm run prisma:studio    # Open Prisma Studio GUI
```

## Public API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/jobs?market={slug}` | List published jobs |
| GET | `/api/public/jobs/{id}` | Job detail |
| POST | `/api/public/applications` | Submit application (multipart form) |
| POST | `/api/public/applications/{id}/withdraw` | Withdraw application |
| GET | `/api/scheduling-links/{token}/slots` | Available interview time slots |
| POST | `/api/scheduling-links/{token}/book` | Book an interview slot |
