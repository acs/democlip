# Specification Quality Checklist: Magnifier Annotation

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- The three clarifications are resolved and recorded in the spec's **Clarifications** section:
  the lens is **in the circle itself**; the rest of the picture is **dimmed** around it; the
  **zoom is adjustable, default 2×**.
- Defaults a clarifier should still see, all recorded in **Assumptions** so they can be
  confirmed or overturned cheaply:
  1. **The lens magnifies its own centre** — at 2× the middle half of the circle fills it, as a
     magnifying glass does, so a detail is centred in the circle. This is the one reading of
     "in the circle itself" that needs saying out loud.
  2. **The dim is one fixed level** the app chooses, not adjustable in this version, easing in
     and out with the annotation; it darkens the clip's picture and never the app's own marks.
  3. **Zoom range** is about 1.5× to 8×, values outside refused with a message.
  4. **Drawn kind only** — not offered on a sound-only clip, where the sound kind still is.
  5. **Numbers, not bytes** — the region, zoom and rim colour are written with the clip; an
     older build drops a magnifier kind it does not know and opens the rest.
- Out of scope is named: a separate lens placed elsewhere, a follow-the-subject lens, an
  adjustable dim, a blur or vignette surround, animated zoom/pan, non-circular lenses,
  magnifying sound, and changing the recording.