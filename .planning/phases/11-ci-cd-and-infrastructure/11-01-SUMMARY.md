---
phase: 11-ci-cd-and-infrastructure
plan: 01
subsystem: infra
tags: [github-actions, eslint, typescript, ci-cd, heft, spfx]

# Dependency graph
requires:
  - phase: 01-08
    provides: "SPFx project with heft build system and API project with TypeScript"
provides:
  - "GitHub Actions CI workflow with parallel SPFx and API build jobs"
  - "ESLint configuration for API project with TypeScript rules"
  - ".sppkg artifact upload on main branch builds"
affects: [11-02, deployment]

# Tech tracking
tech-stack:
  added: [eslint@8, "@typescript-eslint/parser@7", "@typescript-eslint/eslint-plugin@7"]
  patterns: [ci-env-stub-generation, parallel-ci-jobs, conditional-artifact-upload]

key-files:
  created:
    - .github/workflows/ci.yml
    - api/.eslintrc.json
  modified:
    - api/package.json
    - api/package-lock.json
    - api/src/functions/adminBookings.ts

key-decisions:
  - "Pinned ESLint to v8 because v9+/v10 dropped .eslintrc.json support and require flat config migration"
  - "Used void operator for fire-and-forget async IIFE to satisfy no-floating-promises rule"
  - "Set no-explicit-any and no-unused-vars to warn (not error) to avoid breaking CI on existing code"

patterns-established:
  - "CI env stub: Generate placeholder env.generated.ts in CI to bypass local secrets dependency"
  - "Parallel CI jobs: SPFx and API build independently with no needs dependency"
  - "Conditional artifact upload: .sppkg only uploaded on main branch pushes"

requirements-completed: [TOOL-01, TOOL-02]

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 11 Plan 01: CI Workflow Summary

**GitHub Actions CI with parallel SPFx (heft build + .sppkg artifact) and API (tsc + ESLint) jobs, triggered on push/PR to main**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T22:36:36Z
- **Completed:** 2026-03-01T22:39:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GitHub Actions CI workflow with two parallel jobs (build-spfx and build-api)
- SPFx job generates env stub, runs heft test + package-solution, uploads .sppkg artifact on main
- API job runs TypeScript type checking (tsc --noEmit) and ESLint linting
- ESLint configuration for API project with TypeScript-focused rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ESLint configuration and dependencies to API project** - `104a4ac` (feat)
2. **Task 2: Create GitHub Actions CI workflow with parallel SPFx and API jobs** - `309239e` (feat)

## Files Created/Modified
- `.github/workflows/ci.yml` - CI workflow with parallel build-spfx and build-api jobs
- `api/.eslintrc.json` - ESLint config with @typescript-eslint parser and recommended rules
- `api/package.json` - Added eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin devDependencies
- `api/package-lock.json` - Lock file updated with ESLint dependency tree
- `api/src/functions/adminBookings.ts` - Added void to fire-and-forget async IIFE (no-floating-promises fix)

## Decisions Made
- Pinned ESLint to v8 because latest (v10) dropped support for `.eslintrc.json` format; flat config migration was out of scope
- Used `@typescript-eslint` v7 for compatibility with ESLint 8
- Set `no-explicit-any` and `no-unused-vars` to "warn" to avoid breaking CI on existing code while `no-floating-promises` stays at "error" for correctness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned ESLint to v8 instead of latest**
- **Found during:** Task 1 (ESLint configuration)
- **Issue:** `npm install --save-dev eslint` installed ESLint 10.x which dropped `.eslintrc.json` support, requiring `eslint.config.mjs` flat config format
- **Fix:** Pinned to `eslint@8` with compatible `@typescript-eslint/parser@7` and `@typescript-eslint/eslint-plugin@7`
- **Files modified:** api/package.json, api/package-lock.json
- **Verification:** `npx eslint src/ --max-warnings=999` runs without "No ESLint configuration found" error
- **Committed in:** 104a4ac (Task 1 commit)

**2. [Rule 1 - Bug] Added void to fire-and-forget async IIFE in adminBookings.ts**
- **Found during:** Task 1 (ESLint configuration)
- **Issue:** `no-floating-promises` (error level) flagged unhandled async IIFE at line 153 of adminBookings.ts -- intentional fire-and-forget pattern
- **Fix:** Added `void` operator before the async IIFE to explicitly mark it as intentionally unhandled
- **Files modified:** api/src/functions/adminBookings.ts
- **Verification:** ESLint now reports 0 errors (6 warnings remain, all at warn level)
- **Committed in:** 104a4ac (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. ESLint version pin is a compatibility requirement. Void operator fix is the standard pattern for intentional fire-and-forget. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CI workflow ready to validate builds on push/PR to main
- API ESLint configuration in place for automated code quality checks
- Ready for plan 11-02 (additional CI/CD infrastructure)

---
## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 11-ci-cd-and-infrastructure*
*Completed: 2026-03-01*
