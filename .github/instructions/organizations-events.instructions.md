---
description: "Use when discussing, designing, or implementing Organizations, Events, or membership-based attendance for the passkey attendance system. Implementation is complete on the vibed branch."
name: "Organizations and Events Architecture"
---
# Organizations and Events Architecture

**Status: implemented** on the `vibed` branch. The class-based system still ships first; org/event is present in code but deferred for production activation.

---

## What This Feature Is

Organizations and Events extend the system to support attendance for groups that are not academic classes — student orgs, clubs, committees, seminars, elections, sports events, etc.

The core idea: a named group (`Organization`) owns its members; those members may attend `Event`s run by the org. The check-in mechanism is identical to class check-in (passkey + device + proximity), but the **gate** at check-in options time is org membership evaluation instead of `ClassEnrollment` lookup.

---

## Concepts

### Organization

A named group with its own membership list and governance. Examples: BSCS Society, Intramurals Committee, Math Guild.

**Who creates one:** Admin/operator only. This prevents org sprawl started by individual teachers or students.

**What it owns:**
- A set of flat membership rules (who qualifies automatically by user properties)
- A set of explicit membership rows (individual grants, revocations, role elevations)
- A set of Events

**Org-level roles** (applied to members, not to users globally):

| Role | Can do |
|---|---|
| `member` | Qualifies to attend events |
| `moderator` | Read-only on membership; can assist managers but cannot promote |
| `event_creator` | Can create and manage events owned by this org; cannot govern membership |
| `admin` | Full control: define rules, manage members, create events, promote/demote others |

These roles are **relationship-scoped** — a person can simultaneously be a teacher in the system, a `member` in Org A, and an `admin` in Org B. `User.role` (student/teacher/admin/operator) is not extended or changed.

---

### Organization Membership

Three paths to membership — evaluated in priority order:

1. **Explicit revocation** — an org admin has removed this person. Always wins; they are not a member even if rules would qualify them.
2. **Explicit grant or role elevation** — an org admin has added this person manually (e.g. an BSIT student in a BSCS org), possibly with a specific `org_role` and an optional expiry.
3. **Rule-derived** — the org has flat rules like "all students with `program=BSCS`" or "all `year_level=2` users." No rows are written per user; membership is evaluated lazily at check-in time.

**If none of the three match → not a member.**

**Membership rows (`OrganizationMembership`):**

| Field | Type | Notes |
|---|---|---|
| `id` | str PK | UUID |
| `org_id` | str FK → organizations | |
| `user_id` | str FK → users | |
| `membership_type` | str | `explicit_grant`, `explicit_revocation`, or `role_elevation` |
| `org_role` | str \| None | `member`, `moderator`, `event_creator`, or `admin`; null for revocations |
| `granted_at` | datetime | UTC |
| `expires_at` | datetime \| None | Null = no expiry; checked against current time for grants |
| `granted_by` | str \| None FK → users | Who performed the action |

**Effective org_role priority:** if a user has multiple non-revoked rows, the highest role wins: `admin > event_creator > moderator > member`. If only a rule applies (no explicit row), role is `member`.

---

### Organization Membership Rules (`OrganizationMembershipRule`)

Flat rules asserting that all users with certain properties are members. Evaluated lazily when needed.

| Field | Type | Notes |
|---|---|---|
| `id` | str PK | |
| `org_id` | str FK → organizations | |
| `rule_type` | str | `all`, `role`, `program`, or `year_level` |
| `rule_value` | str \| None | The value to match; null for `all` |
| `rule_group` | int \| None | Present for future AND logic; currently ignored (all rules are OR-composed) |

**Critical constraint: `org_member` is FORBIDDEN as a `rule_type` for org rules.** Org rules must reference only flat user properties. This prevents infinite recursion in membership evaluation.

Allowed `rule_type` values for org rules:
- `all` — everyone is a member (open org)
- `role` — all users with `User.role` matching `rule_value` (e.g. `student`)
- `program` — all users with `User.program` matching `rule_value` (e.g. `BSCS`)
- `year_level` — all users with `User.year_level` matching `rule_value` (e.g. `2`)

Multiple rules within an org compose with **OR** — qualifying under any one rule is enough.

---

### Event

A one-off or recurring attendance session owned by an `Organization`. Mechanically identical to class check-in, but:
- The enrollment gate is replaced by `EventAttendeeRule` evaluation
- Thresholds and PI policy come from the `Event` model directly (no `ClassPolicy` needed)
- The associated `CheckInSession` carries `event_id` instead of `class_id`

**Event model fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | str PK | |
| `org_id` | str FK → organizations | Owning org |
| `name` | str | |
| `description` | str \| None | |
| `schedule` | list[dict] (JSON) | Same block shape as `Class.schedule` |
| `standard_assurance_threshold` | int | Default 5 |
| `high_assurance_threshold` | int | Default 9 |
| `play_integrity_enabled` | bool | Default `False` |
| `max_check_ins` | int | Default 3 |
| `created_by` | str \| None FK → users | |
| `created_at` | datetime | |

**No separate EventPolicy model** — the Event owns its own thresholds directly.

**Empty attendee rules = closed event** — no one qualifies if no rules are defined. This is a safe default.

---

### Event Attendee Rules (`EventAttendeeRule`)

Same structure as org rules, but with one additional `rule_type`:

| `rule_type` | `rule_value` | Meaning |
|---|---|---|
| `all` | null | Everyone qualifies |
| `role` | `"student"` etc. | All users with that role |
| `program` | `"BSCS"` etc. | All users with that program |
| `year_level` | `"2"` etc. | All users with that year level |
| `org_member` | `<org_id>` | All members of the referenced org (one-hop resolution) |

**`org_member` is safe here** because it causes one hop into org membership evaluation, and org rules themselves are guaranteed flat (no `org_member` allowed in org rules). Maximum resolution depth is 2 hops.

---

## Membership Resolution Algorithm

This is the evaluation logic that answers "is this user a member of this org?" at check-in time. It is **lazy** — nothing is materialized or pre-computed.

```
is_org_member(user, org_id, db) → bool:
  1. Fetch OrganizationMembership rows for (user_id, org_id).
  2. If any row has membership_type == "explicit_revocation" → return False.
  3. If any row has membership_type in {"explicit_grant", "role_elevation"} AND
     (expires_at is null OR expires_at > now()) → return True.
  4. Fetch OrganizationMembershipRule rows for org_id.
  5. For each rule → if evaluate_org_membership_rule(rule, user) == True → return True.
  6. return False.
```

**Rule evaluation (flat property match only):**
- `all` → always `True`
- `role` → `user.role == rule_value`
- `program` → `user.program == rule_value`
- `year_level` → `str(user.year_level) == rule_value`

**Event attendee resolution:**

```
is_event_attendee(user, event, db) → bool:
  1. Fetch EventAttendeeRule rows for event_id.
  2. If no rules → return False (closed by default).
  3. For each rule:
     - If rule_type == "org_member": call is_org_member(user, rule_value, db) (one hop; safe)
     - Otherwise: flat property match as above
     - If any rule returns True → return True.
  4. return False.
```

---

## User Model Additions (deferred)

When organizations are implemented, two fields are added to `User`:

| Field | Type | Notes |
|---|---|---|
| `program` | str \| None | Degree program code, e.g. `BSCS`, `BSIT`, `BLIS` |
| `year_level` | int \| None | Year in program, e.g. 1, 2, 3, 4 |

`department` — dropped (derivable from program; not a stable independent field).
`section` — dropped (enrollment-dependent; not a stable user property).

These fields are used only by org membership rules and event attendee rules to evaluate program/year_level conditions. They are not used by the class-based system.

---

## Session Bucketing

`CheckInSession` currently has `class_id` (FK → classes). When events are implemented:

- `event_id: Mapped[str | None] = mapped_column(ForeignKey("events.id"), default=None)` is added
- `class_id` and `event_id` are mutually exclusive — exactly one must be non-null
- Invariant is enforced at application layer (in the route handler), not via a DB constraint
- `ClassEnrollment.expires_at: Mapped[datetime | None]` is also added at this time (null = no expiry)

---

## Check-In Flow Differences for Events

When `session.event_id` is set (event check-in), the options and verify handlers diverge:

**Options endpoint:**
- Fetch `Event` by `event_id` instead of `Class` by `class_id`
- Gate: `is_event_attendee(user, event, db)` instead of `ClassEnrollment` lookup
- Thresholds come from `event.standard_assurance_threshold` and `event.high_assurance_threshold`
- `max_check_ins` comes from `event.max_check_ins`
- `play_integrity_enabled` comes from `event.play_integrity_enabled`

**Verify endpoint:**
- Same divergence — replace enrollment check with `is_event_attendee`
- Band computation uses event thresholds

If `session.class_id` is set (class check-in), the existing class-based flow is used. No changes to the class path.

---

## Org Governance Permissions

| Action | Required permission |
|---|---|
| Create org | Admin/operator only |
| Update/delete org | Admin/operator or org `admin` role |
| Create event under org | Org `event_creator` or `admin` role, or system admin/operator |
| Update/delete event | Org `event_creator` or `admin` role, or system admin/operator |
| Grant/revoke membership | Org `admin` role, or system admin/operator |
| Define/remove org rules | Org `admin` role, or system admin/operator |
| Define/remove event attendee rules | Org `event_creator` or `admin` role, or system admin/operator |
| View org member list | Org `moderator`, `event_creator`, or `admin` role, or system admin/operator |

---

## Cross-Class/Event Isolation

Class attendance and event attendance are completely separate:
- No bridge model between classes and events
- No shared sessions (a `CheckInSession` is either class or event, never both)
- Records from event check-ins are linked to an event session; records from class check-ins are linked to a class session
- Teacher dashboards show class sessions; org dashboards show event sessions

---

## UI Surface (Also Deferred)

When implemented, the UI additions needed:

**Web (admin/org-administrator view):**
- Organizations CRUD + member management + rule management
- Events CRUD + attendee rule management
- Event session open/close (same teacher flow, but context switches to event)
- Event attendance records view with org-context assurance band display

**Flutter (student view):**
- Home screen should show both upcoming class sessions and upcoming event sessions
- Check-in flow automatically detects whether the open session is class or event
- No separate app entry point for events — same "Check In Now" trigger

---

## Implementation Checklist (all ❌ pending)

See `architecture-backlog.instructions.md` → "Organizations and Events" section for the full annotated checklist.
