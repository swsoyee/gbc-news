# Implement Plan: 修正技术债审查问题

## Phase 0: Context And Baseline

- [x] Read relevant frontend/backend specs and current README / architecture.
- [x] Run baseline: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`.
- [x] Record current test count.（完成后约 81 tests）

## Phase 1: Frontend Maintainability

- [x] Identify pure functions in `public/subscribe.js` suitable for extraction/testing.
- [x] Add focused tests for URL building and calendar view/date behavior.
- [x] If needed, move reusable logic to a testable module without changing deployed public behavior.
- [x] Validate local preview still works.

## Phase 2: Scrape Single-Source Isolation

- [x] Extract shared scrape snapshot utilities.
- [x] Replace duplicated script logic incrementally.
- [x] Add orchestration that runs each source independently and summarizes failures.
- [x] Add test or script-level validation for one-source-fails scenario.

## Phase 3: HTML Utilities

- [x] Create shared HTML strip/decode helper.
- [x] Replace duplicated scraper helpers one source at a time.
- [x] Run parser fixtures after each replacement.

## Phase 4: Function / Feed Tests

- [x] Refactor `feed-entry.ts` enough to test handler logic.
- [x] Add tests for RSS/iCal format selection and invalid inputs.
- [x] Add build-feeds guard test for empty/partial data where practical.

## Phase 5: Docs And Specs

- [x] Update README current capabilities and local preview instructions.
- [x] Update `docs/architecture.md` for current static frontend reality.
- [x] Update `.trellis/spec/frontend/*` to reflect current public page and quality expectations.

## Final Validation

- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] Review diff for unrelated generated data churn.
- [x] Commit in logical batches.

## Rollback Points

- Commit after each phase.
- Avoid mixing docs/spec updates with risky code changes unless they describe the exact same behavior.
