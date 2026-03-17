---
description: "Use when implementing or reviewing the Next.js web frontend — pages, components, API client, data flow, known bugs, UI gaps, or styling conventions for the passkey attendance system."
name: "Web Frontend Reference"
---
# Web Frontend Reference

The web frontend is a Next.js App Router application in `frontend/web/`. It is the **admin and teacher-facing** interface. Student check-in is handled exclusively by the Flutter app.

---

## Tech Stack

- **Framework:** Next.js App Router (React Server Components by default)
- **UI library:** shadcn/ui (`components/ui/`) + Tabler Icons (`@tabler/icons-react`)
- **Styling:** Tailwind CSS
- **Linting/formatting:** Biome (`pnpm biome check`)
- **API client:** `app/lib/api.ts` (typed fetch wrappers, no external HTTP client library)
- **Icons:** Tabler only — do not use Lucide

---

## Project Layout

```
frontend/web/
  app/
    login/
      page.tsx             — Login + bootstrap entry point (client component)
    (home)/
      layout.tsx           — Sidebar + header shell; wraps all authenticated pages
      error.tsx            — Error boundary
      dashboard/
        page.tsx           — Overview stats + chart
        loading.tsx
      classes/
        page.tsx           — Class list
        loading.tsx
        [class_id]/
          sessions/
            page.tsx       — Sessions for one class
            loading.tsx
            error.tsx
      students/
        page.tsx           — Student list with registration workflow
        loading.tsx
      teachers/
        page.tsx           — Teacher list
        loading.tsx
      records/
        page.tsx           — All attendance records
        loading.tsx
      logs/
        page.tsx           — Audit event log
        loading.tsx
      admins/
        page.tsx           — Admin user list
        loading.tsx
      users/
        page.tsx           — Generic user list
        loading.tsx
    lib/
      api.ts               — All typed API wrappers + DTOs
      navigation.ts        — Nav item definitions
      strings.ts           — UI string constants + ApiPaths
      webauthn.ts          — WebAuthn passkey helpers (web login)
  components/
    ui/                    — shadcn primitives (27 components; do not edit)
    custom/
      app-sidebar.tsx      — Sidebar with role-aware nav
      site-header.tsx      — Top header bar
      nav-information.tsx  — Nav group
      nav-management.tsx   — Nav group
      nav-user.tsx         — User menu in sidebar
      section-cards.tsx    — Dashboard stat cards
      chart-area-interactive.tsx   — Dashboard activity chart (incomplete)
      data-table.tsx       — Generic table shell
      data-table-skeleton.tsx      — Loading placeholder
      data-table-classes.tsx       — Classes table
      data-table-sessions.tsx      — Sessions table
      data-table-teachers.tsx      — Teachers table (read-only)
      data-table-student.tsx       — Students table with registration workflow
      data-table-records.tsx       — Attendance records table
      data-table-users.tsx         — Generic users table
      data-table-logs.tsx          — Audit events table
      registration-qr-dialog.tsx   — QR code display for registration
      search-form.tsx      — Search input (not wired to any table)
  hooks/
    use-mobile.ts
  lib/
    utils.ts               — cn() utility
```

---

## Route Structure

All authenticated pages live inside the `(home)` route group, which provides the sidebar + header shell via `layout.tsx`. The group is entered automatically after login.

| Route | Purpose |
|---|---|
| `/login` | Login landing; also handles first-run bootstrap |
| `/dashboard` | Overview: stat cards + activity chart |
| `/classes` | Class list; drill-down to sessions |
| `/classes/[class_id]/sessions` | Sessions for a specific class |
| `/students` | Student list with registration/unregister actions |
| `/teachers` | Teacher list (read-only) |
| `/records` | All attendance records |
| `/logs` | Audit event log |
| `/admins` | Admin user list |
| `/users` | Generic user list |

---

## `app/lib/api.ts` — API Client

### Origin resolution
- Browser: `NEXT_PUBLIC_API_ORIGIN`
- SSR: `API_ORIGIN_SERVER ?? NEXT_PUBLIC_API_ORIGIN`
- All SSR requests use `cache: "no-store"`

### DTOs declared
`UserDto`, `UserExtendedDto`, `ClassDto`, `AttendanceRecordDto`, `TeacherDto`, `CheckInSessionDto`, `AuditEventDto`, `RegistrationSessionDto`

### Wrapper functions

| Function | Method | Endpoint |
|---|---|---|
| `getBootstrapOperator()` | POST | `/bootstrap/operator` |
| `getUser(userId)` | GET | `/users/{userId}` |
| `getUsers(role?)` | GET | `/users/?role=...` |
| `getStudents()` | GET | `/students` |
| `registerUser(userId)` | POST | `/admin/register/{userId}` |
| `unregisterUser(userId)` | POST | `/admin/unregister/{userId}` |
| `getTeachers()` | GET | `/teachers` |
| `getClasses()` | GET | `/classes` |
| `getClass(classId)` | GET | `/classes/{classId}` |
| `getSessions(params?)` | GET | `/sessions?limit&offset` |
| `getSessionsByClass(classId, params?)` | GET | `/sessions/by-class/{classId}?...` |
| `getSession(sessionId)` | GET | `/sessions/{sessionId}` |
| `getRecords(params?)` | GET | `/records?limit&offset` |
| `getRecordsBySession(sessionId, params?)` | GET | `/records/by-session/{sessionId}?...` |
| `getAuditEvents(params?)` | GET | `/audit?...` |
| `getAuditExportUrl(params?)` | — | Returns URL string for `<a href>` download |

### Known bugs in `api.ts`
- **`getUsers` is declared twice** — the second declaration at the bottom of the file shadows the first and drops the `role` filter parameter. The role filter on `GET /users/` is broken as a result. Fix: remove the duplicate declaration.
- **No auth headers on any request** — no session token is attached. All auth-gated endpoints will reject calls once session tokens are properly enforced. Fix: inject session token from `localStorage` into each request.

### Missing wrappers
The following `ApiPaths` constants exist in `strings.ts` but have no corresponding wrapper functions in `api.ts`:
`openSession`, `closeSession`, `manualRecord`, `manualApproval`, `policies`, `userPolicy`, `credentials`, `enrollments`

These need wrapper functions before any UI that uses them can be built.

---

## Page-by-Page State

### `/login` — `app/login/page.tsx`
Client component. Fetches `GET /bootstrap/status` on mount (raw `fetch`, not `api.ts`). Branches UI based on `isBootstrapMode`.

**What works:**
- Bootstrap mode detection and display
- Bootstrap token submission → `POST /bootstrap/operator` → stores session in `localStorage`

**Known gaps:**
- Passkey login button is rendered but has no `onClick` handler — clicking it does nothing
- Password login button is permanently inert
- `expires_in` is stored in `localStorage` but never read or enforced
- API unreachability on mount is silently swallowed — no error shown
- "Register" link and ToS/Privacy links all point to `#!`

### `/dashboard`
Server component. Fetches up to 1000 records and 100 sessions. Computes today's counts in-page.

**Known gaps:**
- 1000-record ceiling breaks the count once historical records exceed it
- `ChartAreaInteractive` receives no props — it uses entirely hardcoded mock data

### `/classes/[class_id]/sessions`
Server component. Shows sessions for a class; "Back to Classes" link; no class name shown in the header.

### `/students`
Server component passthrough to `DataTableStudent`.

### `/records`
Hard 500-record cap with no pagination or load-more.

### `/logs`
Hard 200-event cap. API supports `event_type`, `actor_id`, date-range filters — none exposed.

---

## Component-by-Component State

### `DataTableStudent` — `components/custom/data-table-student.tsx`

**What works:**
- Full-column table with filtering by role/registered/in_class
- Global search across `full_name`, `school_id`, `email`
- Column visibility toggle
- Per-row "Generate/Regenerate registration QR" → `POST /admin/register/{userId}` → QR dialog
- Registration polling (2s interval until registered)
- `router.refresh()` after registration confirmed

**Known gaps:**
- "Unregister" action renders the menu item but has no `onClick` — clicking it does nothing. `unregisterUser()` exists in `api.ts` but is never called.
- Row drag-and-drop uses `@dnd-kit/core` but `onDragEnd` is missing — rows can be grabbed but nothing happens.
- The student detail drawer is entirely commented out. The commented code contains a chart with hardcoded `desktop/mobile` keys (scaffolding remnant, unrelated to attendance data).
- `chartData` and `chartConfig` exports at the top are dead code (referenced only by the commented drawer).

### `DataTableRecords` — `components/custom/data-table-records.tsx`

**What works:**
- Paginated table: client-side, 20/page default
- Status badge, assurance score + band label, verification methods badges, flag icons (network anomaly ⚠, teacher flag 🚩, sync pending 🔄, manually approved ✓, mock GPS 🛡)

**Known bugs:**
- **Assurance band thresholds are hardcoded at `≥ 25 = High, ≥ 10 = Standard`**. The architecture specifies defaults of high=9, standard=5. At the hardcoded values, virtually every real record will be labeled "Low." Fix: pull thresholds from the record's `standard_threshold_recorded` and `high_threshold_recorded` fields (these are stored per-record as snapshots).

**Known gaps:**
- No actions (approval, flagging) — read-only
- User ID and session ID shown as truncated UUIDs with no name resolution
- No filter/search controls

### `ChartAreaInteractive` — `components/custom/chart-area-interactive.tsx`

**Known bugs and gaps:**
- All 91 data points are hardcoded (April–June 2024 random values)
- Reference date hardcoded as `2024-06-30` (TODO in code)
- Both chart series (`records` and `flagged`) render with `var(--primary)` — visually indistinguishable
- Accepts no props; has no internal fetch; cannot be connected to live data without a full refactor

### `SectionCards` — `components/custom/section-cards.tsx`

**What works:** Displays `recordsToday`, `flaggedToday`, `openSessions` passed as props from the dashboard page.

**Known gaps:**
- 4-column grid with only 3 cards — fourth slot is always empty at wide breakpoints
- Cards are display-only; no click-through to filtered views

### `SearchForm` — `components/custom/search-form.tsx`

Renders a search input but is not connected to any table filtering logic. Dead UI element.

---

## Styling and Component Conventions

- Edit real app components in `components/custom/`; do not edit `components/ui/` (shadcn primitives)
- Use Tabler icons (`@tabler/icons-react`) — do not use Lucide icons anywhere
- Use Biome for linting/formatting: `pnpm biome check`
- shadcn components are added via `pnpm dlx shadcn@latest add <component>` — never edit generated shadcn files manually

---

## Missing Pages (Not Yet Built)

These are the unimplemented parts of the web UI needed for a working class-based system:

| Missing | Backend support | Priority |
|---|---|---|
| Session records drill-down (records for one session) | `GET /records/by-session/{id}` | P0 |
| Manual approval UI (approve/reject low-assurance records) | `POST /records/approve` | P0 |
| Session open/close controls (teacher-initiated) | `POST /sessions/open/teacher`, `POST /sessions/{id}/close` | P0 |
| Student detail page / per-student attendance history | `GET /records/by-user/{id}` | P1 |
| Class policy management (thresholds, PI toggle, timing) | `ClassPolicy` endpoints | P1 |
| Enrollment management (add/remove students from classes) | `/enrollments` endpoints | P1 |
| Credential revocation UI | `DELETE /credentials/{id}` | P1 |
| Dashboard live chart | `GET /records` with date grouping | P2 |
| Audit log filters (event type, date range) | query params on `GET /audit/` | P2 |
| Search form wired to tables | client-side filter | P2 |

---

## Auth State (Current Gap)

No session token is currently injected into any API request in `api.ts`. The web frontend relies on the backend's CORS and session middleware, but no `Authorization` header or cookie is sent. This means all auth-gated endpoints will fail for any user who has logged in via the web. Fix required before the web UI can perform any write action.
