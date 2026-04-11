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
      orgs/
        page.tsx           — Organization list
        [org_id]/
          page.tsx         — Organization detail (members, rules, events)
          events/
            [event_id]/
              page.tsx     — Event detail (attendee rules)
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
      org-list.tsx         — Organization card list with create/delete
      org-detail.tsx       — Organization detail: members, rules, events sections
      event-detail.tsx     — Event detail: attendee rule CRUD
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
| `/orgs` | Organization list |
| `/orgs/[org_id]` | Organization detail: members, rules, events |
| `/orgs/[org_id]/events/[event_id]` | Event detail: attendee rules |

---

## `app/lib/api.ts` — API Client

### Origin resolution
- Browser: `NEXT_PUBLIC_API_ORIGIN`
- SSR: `API_ORIGIN_SERVER ?? NEXT_PUBLIC_API_ORIGIN`
- All SSR requests use `cache: "no-store"`

### DTOs declared
`UserDto`, `UserExtendedDto`, `ClassDto`, `AttendanceRecordDto`, `TeacherDto`, `CheckInSessionDto`, `AuditEventDto`, `RegistrationSessionDto`, `CredentialDto`, `OrgDto`, `OrgMemberDto`, `OrgRuleDto`, `EventDto`, `EventRuleDto`

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
| `getCredentials(userId)` | GET | `/credentials/by-user/{userId}` |
| `revokeCredential(credId)` | DELETE | `/credentials/{credId}` |
| `offlineSync(body)` | POST | `/sessions/offline-sync` |
| `getOrgs()` | GET | `/orgs` |
| `getOrg(orgId)` | GET | `/orgs/{orgId}` |
| `createOrg(body)` | POST | `/orgs` |
| `updateOrg(orgId, body)` | PUT | `/orgs/{orgId}` |
| `deleteOrg(orgId)` | DELETE | `/orgs/{orgId}` |
| `getOrgMembers(orgId)` | GET | `/orgs/{orgId}/members` |
| `addOrgMember(orgId, body)` | POST | `/orgs/{orgId}/members` |
| `removeOrgMember(orgId, id)` | DELETE | `/orgs/{orgId}/members/{id}` |
| `getOrgRules(orgId)` | GET | `/orgs/{orgId}/rules` |
| `addOrgRule(orgId, body)` | POST | `/orgs/{orgId}/rules` |
| `removeOrgRule(orgId, id)` | DELETE | `/orgs/{orgId}/rules/{id}` |
| `getEvents(orgId)` | GET | `/orgs/{orgId}/events` |
| `getEvent(orgId, eventId)` | GET | `/orgs/{orgId}/events/{eventId}` |
| `createEvent(orgId, body)` | POST | `/orgs/{orgId}/events` |
| `deleteEvent(orgId, eventId)` | DELETE | `/orgs/{orgId}/events/{eventId}` |
| `getEventRules(orgId, eventId)` | GET | `/orgs/{orgId}/events/{eventId}/rules` |
| `addEventRule(orgId, eventId, body)` | POST | `/orgs/{orgId}/events/{eventId}/rules` |
| `removeEventRule(orgId, eventId, id)` | DELETE | `/orgs/{orgId}/events/{eventId}/rules/{id}` |

### Current auth model in `api.ts`
- Browser requests attach `X-Session-Token` from localStorage.
- SSR requests attach `X-Session-Token` from the mirrored session cookie so authenticated server components can call protected backend endpoints.
- `requestAll()` handles paginated aggregation for pages that need the full dataset rather than the first page.

### Missing wrappers
The following backend areas still lack complete wrapper coverage in `api.ts`:
`openSession`, policy CRUD, enrollment CRUD, and record update (`PUT /records/{id}`)

Credential CRUD and org/event wrappers were added on the vibed branch.

---

## Page-by-Page State

### `/login` — `app/login/page.tsx`
Client component. Fetches `GET /bootstrap/status` on mount (raw `fetch`, not `api.ts`). Branches UI based on `isBootstrapMode`.

**What works:**
- Bootstrap mode detection and display
- Bootstrap token submission → `POST /bootstrap/operator` → persists session in both `localStorage` and cookie storage
- Existing-session redirect into the authenticated app shell
- Unsupported browser passkey login is explicitly disabled instead of being a dead click target

**Known gaps:**
- Browser passkey login remains disabled because the current backend login contract requires the app-layer device signature and enrolled device key, which the browser client does not provide
- Password login button is permanently inert
- API unreachability on mount is silently swallowed — no error shown
- "Register" link and ToS/Privacy links all point to `#!`

### `/dashboard`
Server component. Fetches all records and sessions through paginated helpers. Computes today's counts in-page and passes live daily aggregates to the chart component.

**Known gaps:**
- No drill-down/filter controls from the stat cards or chart yet

### `/classes/[class_id]/sessions`
Server component. Shows sessions for a class; "Back to Classes" link; no class name shown in the header.

### `/students`
Server component passthrough to `DataTableStudent`.

### `/records`
Server component. Fetches all records through paginated helpers.

**Known gaps:**
- No server-backed pagination or filter UI yet

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
- Per-row unregister action wired to `POST /admin/unregister/{userId}`
- Local drag-and-drop row reordering
- `router.refresh()` after registration confirmed

**Known gaps:**
- The student detail drawer is entirely commented out.

### `DataTableRecords` — `components/custom/data-table-records.tsx`

**What works:**
- Paginated table: client-side, 20/page default
- Status badge, assurance score + band label using recorded threshold snapshots, verification methods badges, flag icons (network anomaly ⚠, teacher flag 🚩, sync pending 🔄, manually approved ✓, mock GPS 🛡)

**Known gaps:**
- No actions (approval, flagging) — read-only
- User ID and session ID shown as truncated UUIDs with no name resolution
- No filter/search controls

### `ChartAreaInteractive` — `components/custom/chart-area-interactive.tsx`

Prop-driven chart component used by the dashboard. It renders live daily aggregates for total records and flagged records.

**Known gaps:**
- No range selector or drill-down interaction yet
- Still dashboard-specific rather than a reusable reporting component

### `SectionCards` — `components/custom/section-cards.tsx`

**What works:** Displays `recordsToday`, `flaggedToday`, `openSessions` passed as props from the dashboard page.

**What works:** Displays `recordsToday`, `flaggedToday`, `openSessions`, `totalSessions` passed as props from the dashboard page. 4-card grid fills all slots.

**Known gaps:**
- Cards are display-only; no click-through to filtered views

### `SearchForm` — `components/custom/search-form.tsx`

Renders a search input but is not connected to any table filtering logic. Dead UI element.

---

## Styling and Component Conventions

- Edit real app components in `components/custom/`; do not edit `components/ui/` (shadcn primitives)
- Use Tabler icons (`@tabler/icons-react`) — do not use Lucide icons anywhere
- Use Biome for linting/formatting: `pnpm biome check`
- shadcn components are added via `pnpm dlx shadcn@latest add <component>` — never edit generated shadcn files manually
- When a `Select` stores machine values or IDs but displays human-friendly labels, do not rely on bare `SelectValue`; render the closed-state label explicitly or use a shared label helper
- Keep dropdown-style controls visually consistent: reuse shared row-action patterns for table menus, keep destructive items explicit, and avoid one-off trigger sizes unless there is a concrete UX reason
- Live admin tables must use `DataTableScaffold` from `components/custom/data-table-shared` for outer spacing and toolbar/content layout; do not recreate ad hoc `gap`/`px` wrapper shells per table
- For the standard table search/filter/column-visibility row, use `DataTableToolbar` from `components/custom/data-table-shared` instead of rebuilding the search and right-side controls by hand
- For standard live-table filters in that toolbar row, use the shared right-side `DataTableFilterSheet` primitives from `components/custom/data-table-shared`; do not build new dropdown filter menus for those pages

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
| Audit log filters (event type, date range) | query params on `GET /audit/` | P2 |
| Search form wired to tables | client-side filter | P2 |

### Implemented on vibed branch

| Page | What it does |
|---|---|
| `/orgs` | Organization list with create/delete dialogs |
| `/orgs/[org_id]` | Organization detail: members (add/revoke with role selectors), rules (add/delete with rule type selector), events (create/delete + link to event detail) |
| `/orgs/[org_id]/events/[event_id]` | Event detail: attendee rule CRUD with back-to-org link |
| 4th dashboard card | "Total sessions" card added to SectionCards |
| Scaffold cleanup | Dead `chartData`/`chartConfig` exports and commented-out `TableCellViewer` removed from `data-table-student.tsx` |

---

## Auth State (Current Gap)

Authenticated browser requests now use `X-Session-Token` from localStorage, and authenticated SSR requests use the mirrored session cookie. This is sufficient for the current bootstrap-backed web flow.

The remaining auth constraint is architectural, not transport-related: browser passkey login is still disabled because the backend login flow expects the app-layer device signature and enrolled device key that exist only on the mobile client today.
