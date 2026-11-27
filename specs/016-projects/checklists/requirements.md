# Specification Quality Checklist: Projects

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-27
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

### Validation Notes — iteration 1 (2026-11-27)

Three clarifications were open in the first draft and are now resolved in the spec's
**Clarifications** section and reflected throughout:

1. **Profile inheritance** — a project names a **default** profile; a recording starts under it and the
   person may change **the recording's profile** before capture. The existing invariant is unchanged:
   whichever profile is in force locks every item it declares, and the exception is a different
   profile for that clip, never an editable declared item.
2. **Recording plan** — for now, the project's **description** (its motivation and objectives) stands in
   for a plan; progress is derived from the recordings. No checklist, schedule or set of planned
   recordings is modelled, and structured planning is deferred to a later iteration.
3. **Removing a recording from a project** — moves it to the Default project. Deleting a
   recording for good is a separate, explicit, confirmed act.

Checks performed against the spec:

- **No implementation details**: the spec names the app's existing products — profiles and the
  agent interface — and no language, library, store or API. "MCP" appears only in the quoted
  user input; the requirements speak of the *agent interface*.
- **Testable requirements**: every FR has an observable outcome, and the acceptance scenarios
  are stated as Given/When/Then.
- **Measurable outcomes**: SC-001 to SC-010 carry a count, a time or a percentage (100%, zero
  lost, 2 seconds, three actions, 10%).
- **Scope bounded**: local-only, one recording open at a time, no schedule or checklist for the
  plan, no change to recording/cutting/exporting.
- **Dependencies**: configuration profiles, clip keeping, the agent interface — all named.

### Validation Notes — iteration 2 (2026-11-27)

The profile clarification was corrected after review. The earlier reading — a clip overriding
individual items a profile declares — would have changed the lock invariant of
`specs/009-config-profiles`. The corrected rule keeps it:

- A project names a **default** profile, not a fixed one.
- A recording starts under that default and may use **another profile**, chosen before it
  begins to capture; the choice is recorded with the recording.
- Whichever profile is in force **locks every item it declares**, exactly as today.

The spec, its user story, edge cases, requirements, entities, success criteria, assumptions and
dependencies were updated to match, and the "Override" entity was replaced by "Clip profile". All
checklist items still pass.

### Validation Notes — iteration 3 (2026-11-27)

The recording plan was simplified on the user's instruction: it is **the project's description for
now**, and will be evolved in a future iteration. The separate plan note was removed; the
description is the project's motivation and objectives. User Story 4, FR-032 to FR-034, the
Project entity and the assumptions now say so explicitly, and a scenario states that no structured
plan is required or implied. Progress remains derived from the recordings, and the checklist items
still pass.

### Carried into planning

- **Constitution V (the words come first)**: `project`, `recording`, `default project`,
  `project default profile`, `clip profile` and `completed` must be written into
  `docs/GLOSSARY.md` before they appear in code.
- **Constitution III/IV**: the project's rules (membership, default profile, the clip's profile,
  progress, migration) belong in `src/domain/` with unit tests; the project list, overview and the
  profile lock display are browser-verified with a harness.
- **No change to the profile invariant**: `specs/009-config-profiles/spec.md` and the Profiles
  section of `docs/GLOSSARY.md` stand as they are. The plan should extend them with the project's
  default profile and the clip's profile, not rewrite the lock.