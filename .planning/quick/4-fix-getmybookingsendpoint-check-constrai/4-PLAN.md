---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - api/setup-db.js
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "getMyBookingsEndpoint no longer throws CHECK constraint error when autoExpireBookings sets status to Overdue"
    - "setup-db.js creates a database where all 5 booking statuses (Confirmed, Active, Completed, Cancelled, Overdue) are valid"
  artifacts:
    - path: "api/setup-db.js"
      provides: "Database setup script with correct Bookings status CHECK constraint including Overdue"
      contains: "Overdue"
  key_links:
    - from: "api/src/services/bookingService.ts"
      to: "database CHECK constraint"
      via: "autoExpireBookings UPDATE status = Overdue"
      pattern: "SET status = 'Overdue'"
---

<objective>
Fix the CHECK constraint error that crashes getMyBookingsEndpoint.

Purpose: The `autoExpireBookings()` function (called by `getMyBookings`) tries to UPDATE booking status to 'Overdue', but the database CHECK constraint only allows ('Confirmed', 'Active', 'Completed', 'Cancelled'). The Phase 4 schema migration that adds 'Overdue' to the constraint was written in schema.sql but never ported to setup-db.js. This causes a runtime crash: `The UPDATE statement conflicted with the CHECK constraint "CK__Bookings__status__5165187F"`.

Output: Fixed setup-db.js that drops the old inline CHECK constraint and creates a named one including 'Overdue'.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@api/setup-db.js
@api/src/sql/schema.sql (lines 86-97 — the Phase 4 constraint migration that was never ported)
@api/src/services/bookingService.ts (autoExpireBookings function, lines 27-55)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Overdue status to Bookings CHECK constraint in setup-db.js</name>
  <files>api/setup-db.js</files>
  <action>
In `api/setup-db.js`, add two new statements to the `statements` array AFTER the existing booking lifecycle ALTER TABLE statements (after `ALTER TABLE Bookings ADD cancelReason NVARCHAR(500) NULL` on line 97) and BEFORE the calendar integration statements (before `ALTER TABLE Vehicles ADD resourceMailboxEmail` on line 100).

Add these two statements to the array:

1. Drop the existing inline CHECK constraint on Bookings.status (uses dynamic SQL since the auto-generated constraint name varies per database):
```sql
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
WHERE cc.parent_object_id = OBJECT_ID('Bookings') AND c.name = 'status';
IF @constraintName IS NOT NULL
  EXEC('ALTER TABLE Bookings DROP CONSTRAINT ' + @constraintName);
```

2. Add the named constraint including 'Overdue':
```sql
ALTER TABLE Bookings ADD CONSTRAINT CK_Bookings_Status
  CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled', 'Overdue'))
```

These match exactly what schema.sql specifies in its Phase 4 section (lines 86-97).

IMPORTANT: The setup-db.js error handler on line 116 already handles "already exists" errors gracefully, and the DROP uses IF NOT NULL, so this is safe to run on both fresh and existing databases. On an existing database that already has the old constraint, statement 1 drops it and statement 2 creates the new one. On a database where the migration already ran, statement 1 drops the existing named constraint and statement 2 recreates it (idempotent).
  </action>
  <verify>
    <automated>cd /Users/dancomilosevici/DevLeet/Microsoft-365-Solutions/rentAvehicle-sp-webpart && node -e "
const fs = require('fs');
const content = fs.readFileSync('api/setup-db.js', 'utf8');
const hasOverdue = content.includes(\"'Overdue'\");
const hasDropConstraint = content.includes('DROP CONSTRAINT');
const hasCKBookingsStatus = content.includes('CK_Bookings_Status');
console.log('Has Overdue:', hasOverdue);
console.log('Has DROP CONSTRAINT:', hasDropConstraint);
console.log('Has CK_Bookings_Status:', hasCKBookingsStatus);
if (!hasOverdue || !hasDropConstraint || !hasCKBookingsStatus) process.exit(1);
console.log('PASS: All constraint fix markers present');
"</automated>
  </verify>
  <done>setup-db.js includes the Phase 4 constraint migration: drops the old inline CHECK on Bookings.status and creates CK_Bookings_Status allowing ('Confirmed', 'Active', 'Completed', 'Cancelled', 'Overdue'). The autoExpireBookings UPDATE to 'Overdue' will no longer violate the constraint.</done>
</task>

</tasks>

<verification>
1. `api/setup-db.js` contains 'Overdue' in a CHECK constraint statement
2. The constraint drop statement uses dynamic SQL to find the auto-generated constraint name (matching schema.sql)
3. The new named constraint CK_Bookings_Status allows all 5 statuses
4. Statements are in the correct order: lifecycle columns, then constraint migration, then calendar columns
</verification>

<success_criteria>
- setup-db.js drops the old 4-value CHECK constraint and creates a 5-value one including 'Overdue'
- Running setup-db.js on the live database will fix the constraint, unblocking getMyBookingsEndpoint
- The fix matches the schema.sql Phase 4 migration exactly
</success_criteria>

<output>
After completion, create `.planning/quick/4-fix-getmybookingsendpoint-check-constrai/4-SUMMARY.md`
</output>
