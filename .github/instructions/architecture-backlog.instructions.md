---
description: "Use when discussing architecture planning, attack path coverage, security hardening priorities, or IMRAD architecture writing for the passkey attendance system."
name: "Architecture Backlog Guidance"
---
# Architecture Backlog Guidance

## Source of Truth Separation
- Treat `.github/copilot-instructions.md` as stable project conventions and settled architecture decisions.
- Treat `scratchboard/TO_BE_IMPLEMENTED_ARCHITECTURE_BACKLOG.md` as the authoritative backlog for deferred work, attack path coverage, and implementation priorities.
- Treat `scratchboard/IMRAD_ARCHITECTURE_REFERENCE_BULLETS.md` as the architecture-writing baseline for IMRAD drafting.

## Response Style for Architecture Tasks
- Lead with architectural goals and trust boundaries before implementation details.
- Use implementation state only as evidence for coverage or gaps, not as the main framing.
- When reviewing security posture, map each attack path to:
  - coverage status
  - missing control
  - residual risk
  - recommended priority (P0/P1/P2)

## Update Rules
- Do not duplicate large, fast-changing status inventories in `copilot-instructions.md`.
- When new deferred tasks are identified, append or refine them in `scratchboard/TO_BE_IMPLEMENTED_ARCHITECTURE_BACKLOG.md`.
- When architecture narrative shifts, update `scratchboard/IMRAD_ARCHITECTURE_REFERENCE_BULLETS.md` first, then adjust IMRAD draft sections.

## Prioritization Heuristic
- P0: controls that change correctness or security guarantees.
- P1: controls that reduce abuse/replay/operational risk but do not block core flow correctness.
- P2: reliability and scaling hardening once core controls are in place.

## School-Network-Only Notes
- Assume no major component redesign; focus on DNS/TLS trust, segmentation, and policy adjustments.
- Explicitly note whether Play Integrity is available or downgraded under network constraints.
