# ROHM — HR Readiness Dashboard

Staff readiness assessment system for the Royal Opera House Muscat.

Evaluates employees across two dimensions — **Commitment** (motivation, engagement, ownership) and **Competency** (technical capability, role knowledge, output quality) — to classify staff into four quadrants and surface actionable insights at the individual, department, and organization level.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Seed the demo database (SQLite, zero config)
pnpm db:seed

# 3. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app is immediately demoable with 42 employees, 14 departments, 140 tailored questions, and 3 months of assessment history.

## What's Inside

### Pages

| Route | Description |
|-------|-------------|
| Dashboard | Org-wide overview: quadrant scatter, distribution donut, department comparison bars, gap analysis |
| Departments | Grid of all 14 departments sorted by readiness, click to drill down |
| Department Drilldown | Per-department: quadrant chart, score trend, employee roster, intervention recommendations |
| Employee Profile | Individual: score gauges, question-level breakdown, trend over time, comparative context, development insights |
| New Assessment | 4-step form: select employee → rate commitment → rate competency → review & submit |
| Unrated Tracker | Who hasn't been assessed this month, grouped by department |
| Org Chart | Expandable tree of the full ROHM hierarchy |
| Notifications | Admin feed: review submissions, star performer alerts, low-score warnings, cycle reminders |
| Settings | Quadrant threshold configuration with scoring formula reference |

### Architecture

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Recharts
- **Database**: SQLite via Drizzle ORM (swap to Postgres by changing the driver)
- **State**: Zustand for client-side filters and demo role switching
- **Scoring**: Weighted arithmetic mean — `Σ(score × weight) / Σ(weight)` — self-normalizing across any number of questions

### Demo Features

- **Role Switcher**: Toggle Admin ↔ Manager in the sidebar to test different access levels
- **Confetti Welcome**: First login as Naim triggers a confetti animation + welcome modal
- **3 Months of History**: Score trends show employee and department trajectories over Jan → Feb → Mar 2026
- **Realistic Data**: Employees have personality profiles — some improve, some decline, some stay consistent

## Database

### Seed

```bash
pnpm db:seed
```

Populates:
- 14 departments with unit hierarchy (from ROHM org chart)
- 42 employees with realistic Omani and international names
- 140 assessment questions (tailored per department)
- 4 assessment cycles (Jan–Apr 2026)
- 126 assessments (42 × 3 closed months) with trending scores
- Pre-computed monthly department statistics
- Sample notifications
- Default settings (threshold: 7.0)

The seed is idempotent — run it again to reset to fresh data.

### Schema

9 tables: `users`, `org_nodes`, `employees`, `assessment_questions`, `assessment_cycles`, `assessments`, `assessment_responses`, `monthly_department_stats`, `notifications`, `settings`.

See `src/lib/db/schema.ts` for the full Drizzle schema with relations and indexes.

### Migrations

```bash
pnpm db:generate  # Generate migration files from schema changes
pnpm db:migrate   # Push schema to database
pnpm db:studio    # Open Drizzle Studio (visual DB browser)
```

## Production Deployment

### Swap to Postgres

1. Install `@neondatabase/serverless` or `postgres` driver
2. Update `drizzle.config.ts` to `dialect: "postgresql"`
3. Set `DATABASE_URL` in `.env`
4. Run `pnpm db:migrate` then `pnpm db:seed`

### Deploy to Vercel + Supabase

1. Create a Supabase project → copy the connection string
2. Set env vars in Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
3. Push to GitHub → Vercel auto-deploys
4. Run seed against production DB: `DATABASE_URL=... pnpm db:seed`

## Environment Variables

See `.env.example` for all available configuration.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # App shell (sidebar + all pages)
│   └── api/dashboard/       # Data API routes
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema (9 tables)
│   │   ├── seed.ts          # Demo data seeder
│   │   └── index.ts         # DB connection
│   ├── services/
│   │   ├── scoring.ts       # Score calculation engine
│   │   ├── data.ts          # All data queries
│   │   └── notifications.ts # Dispatch abstraction (Outlook-ready)
│   ├── types.ts             # Shared TypeScript types
│   ├── utils.ts             # Utilities (cn, formatters)
│   └── api-client.ts        # Client-side fetch wrapper
├── stores/
│   └── dashboardStore.ts    # Zustand (filters, demo role)
└── styles/
    └── globals.css          # Tailwind + design tokens
```

## Future Work

- **Auth**: NextAuth.js with Credentials provider (beta) → Azure AD / Microsoft Entra (production)
- **Outlook Integration**: `NotificationDispatcher` interface is ready — add `OutlookDispatcher` using Microsoft Graph API
- **Image Uploads**: Supabase Storage bucket for employee profile photos
- **Question Editor**: Admin UI for adding/removing/reweighting assessment questions
- **Employee CRUD**: Admin settings page for managing the employee roster
- **Visual Refresh**: Waiting for design inspiration images to lock the final palette
