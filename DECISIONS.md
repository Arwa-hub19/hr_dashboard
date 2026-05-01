# DECISIONS.md — Non-Obvious Architectural Choices

## 1. SQLite for Demo, Postgres for Production

**Choice**: SQLite via better-sqlite3 for the demo phase, designed for a seamless swap to Postgres.

**Why**: Zero infrastructure setup — `pnpm install && pnpm db:seed && pnpm dev` works immediately. No Docker, no database server, no connection strings. The Drizzle ORM schema is dialect-agnostic; swapping requires changing one import and the config file.

**Trade-off**: SQLite doesn't support concurrent writes well. Acceptable for a single-user demo; production needs Postgres.

## 2. Single Self-Referential `org_nodes` Table

**Choice**: One table with `parent_id` and `level` enum instead of three separate tables (departments, sub_departments, units).

**Why**: The ROHM hierarchy is consistent (always ≤3 levels), but some departments have no sub-units (Artistic Western, Security, Retail). A single table handles both cases without nullable foreign keys or empty join tables. Adding a 4th level later requires zero schema changes. Ancestry queries use simple recursive walks — Postgres recursive CTEs handle this natively in production.

**Alternative considered**: Three tables with explicit FK chains. Rejected because 4 of 14 departments have no sub-units, making the middle table awkward.

## 3. JSONB Question Snapshots on Assessments

**Choice**: When an assessment is submitted, the full question set (text, weight, dimension) is serialized into a `question_snapshot` column on the assessments table.

**Why**: Admin can edit questions at any time. Historical assessments must remain readable with the questions that existed at submission time. A snapshot guarantees this without a separate versioning table.

**Storage impact**: ~2KB per assessment × 281 employees × 12 months = ~6.6MB/year. Negligible.

**Alternative considered**: `assessment_question_versions` table with explicit version numbers. More queryable for analytics but adds complexity — version chains, migration logic, join cost. The snapshot is simpler and covers the primary use case (viewing historical assessments). We keep normalized `assessment_responses` rows alongside the snapshot for analytics queries.

## 4. Pre-Computed `monthly_department_stats` Table

**Choice**: A denormalized rollup table that stores monthly averages, gap direction, and quadrant distribution per department.

**Why**: The dashboard needs to show both real-time readiness (current month) and historical trends (line charts over months). Computing aggregates from raw assessment data on every page load is expensive as data grows. The stats table gives O(1) reads for dashboard tiles and trend charts.

**When it's populated**: After every assessment submission (or by a batch recompute job). The seed script pre-populates it for all historical months.

## 5. Scoring Formula: Weighted Arithmetic Mean

**Choice**: `Σ(score_i × weight_i) / Σ(weight_i)` with weights defaulting to 1.0.

**Why**: Self-normalizing — adding or removing questions doesn't break the formula. The denominator adjusts automatically. When all weights are equal, it reduces to a simple average. When admin marks a question as more important (weight > 1.0), it influences the score proportionally without requiring any code changes.

**Alternative considered**: Simple average (ignore weights). Rejected because the spec requires weight support for future use, and the weighted mean costs nothing when weights are all 1.0.

## 6. Client-Side SPA Shell in a Single Page Component

**Choice**: The entire app lives in `page.tsx` as a client component with internal routing via state, rather than using Next.js file-based routing for each view.

**Why**: All pages share a persistent sidebar, role context, and Zustand state. Every chart requires client-side hydration anyway (Recharts). File-based routing would mean server-component pages that immediately delegate to client chart wrappers — adding indirection without benefit. The single-shell approach keeps navigation instant (no page reloads) and state consistent.

**When to split**: When auth is added (Milestone 2), protected routes should use Next.js middleware for server-side redirects. At that point, extract each page into its own route file and use server components for data loading + client components for charts.

## 7. Demo Role Switcher via Zustand (No Real Auth)

**Choice**: A toggle in the sidebar switches between Admin and Manager views. No real authentication.

**Why**: The spec says "build a demo first, then work on auth." The RBAC service layer is already structured with `SessionContext` — when NextAuth is added, the only change is swapping the context source from Zustand to the session provider.

**The role switcher is intentionally visible**: This is a demo tool for stakeholders to test both views. It will be removed when real auth is implemented.

## 8. Notification Dispatcher Abstraction

**Choice**: A `NotificationDispatcher` interface with a registry pattern, rather than direct DB writes.

**Why**: The spec requires a "clean abstraction for future Outlook integration." The current `DatabaseDispatcher` writes to the notifications table. A future `OutlookDispatcher` calls Microsoft Graph API. Both implement the same interface. Adding Outlook means writing one class and registering it — zero changes to notification creation logic.

**The same pattern applies to `UserDirectoryProvider`**: Currently reads from the local users table. Future: Microsoft Graph `/users` endpoint for SSO-synced employee data.

## 9. Employee Score Profiles with Monthly Trends

**Choice**: Each seeded employee has a "personality profile" with base scores and a monthly trend (positive, negative, or flat).

**Why**: Realistic demo data requires movement over time. Flat scores across all months make trend charts meaningless. The profiles create natural stories — an employee improving their skills month-over-month, another losing motivation — that make the dashboard feel like a real tool rather than a static mockup.

## 10. Tailored Questions Per Department

**Choice**: 140 questions total, 10 per department (5 commitment + 5 competency), each written for that department's specific function.

**Why**: The spec explicitly requires this: "A marketing role will require a different set of competency indicators than a technical or administrative role." Generic questions (e.g., "demonstrates teamwork") don't surface meaningful data. Department-specific questions (e.g., "Can independently manage rigging safety protocols during a live production?") drive actionable insights.

## 11. Neutral Palette Baseline (Pending Inspiration Images)

**Choice**: Muted warm palette (deep burgundy/charcoal/cream/champagne) with subtle gold accents, matching the "opera house" aesthetic brief. Using Tailwind custom color scale `brand-*` for easy re-theming.

**Why**: The spec says "wait for inspiration images before locking the visual system." The current palette is tasteful and restrained — easily adjustable by updating the Tailwind config's `brand` color scale. All UI components use semantic tokens (`brand-800`, `surface-card`, `accent-gold`) rather than hardcoded hex values.
