---
status: resolved
trigger: "UAT Tests 3+4: Timezone ComboBox not filtering and text appends instead of replacing"
created: 2026-03-03T12:00:00Z
updated: 2026-03-04T00:00:00Z
---

## Current Focus

hypothesis: Fluent UI ComboBox with allowFreeform={true} and autoComplete="on" causes text to append to existing value instead of clearing, and lacks custom filtering logic for 419 options
test: Code review of ComboBox props and Fluent UI docs
expecting: Missing allowFreeform=false or missing onInputValueChange handler for filtering
next_action: Return diagnosis

## Symptoms

expected: Clicking timezone cell opens searchable ComboBox; typing filters the list
actual: Click opens pre-filled input text; typed text appends to existing value; list never filters
errors: none (UX issue, not runtime error)
reproduction: Click any timezone cell in Locations admin view, start typing
started: Since implementation (phase 12)

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-03T12:00:00Z
  checked: LocationList.tsx lines 197-211 (ComboBox configuration)
  found: |
    ComboBox props: allowFreeform={true}, autoComplete="on", selectedKey={tz}, no onInputValueChange handler.
    With allowFreeform=true the input is fully editable -- user can type arbitrary text that appends to the existing selectedKey display value.
    autoComplete="on" causes Fluent UI to auto-complete (append matching suffix) rather than filter-as-you-type.
    There is no custom filtering logic -- all 419 options are always passed.
  implication: This is the root cause of both UAT issues (3 and 4)

- timestamp: 2026-03-03T12:00:00Z
  checked: timezones.ts -- TIMEZONE_OPTIONS array
  found: 419 static IComboBoxOption entries, no grouping or virtualization
  implication: A 419-item unfiltered dropdown is unusable; filtering is essential

## Resolution

root_cause: |
  Two Fluent UI ComboBox configuration errors in LocationList.tsx (lines 197-211):

  1. **allowFreeform={true}** -- This makes the input a free-text field. The user can type arbitrary characters that get appended to the existing displayed timezone value (e.g., "Europe/Berlinber" when trying to search "ber"). The ComboBox does NOT clear the input on focus when freeform is enabled -- it preserves the selectedKey's text.

  2. **autoComplete="on" without onInputValueChange** -- Fluent UI ComboBox autoComplete="on" performs inline auto-completion (appends matching suffix to the input), but it does NOT filter the dropdown list. The dropdown always shows all 419 options. To get filter-as-you-type behavior, you must either:
     - Use allowFreeform={true} with a custom onInputValueChange handler that filters options dynamically, OR
     - Use allowFreeform={false} with autoComplete="on" (which constrains input to valid options and does prefix matching)

  The combination of allowFreeform={true} + autoComplete="on" + no custom filtering = worst of all worlds: user can type anything, text appends to existing value, and the full 419-item list never filters.

fix: ""
verification: ""
files_changed: []
