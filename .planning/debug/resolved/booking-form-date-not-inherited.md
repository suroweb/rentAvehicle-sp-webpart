---
status: resolved
trigger: "Booking form on VehicleDetail doesn't inherit date/time selection from Browse Vehicles page"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: Date/time state from VehicleBrowse is never passed to VehicleDetail -- navigation only passes vehicleId
test: Trace the full navigation chain from VehicleBrowse -> AppShell -> VehicleDetail -> BookingForm
expecting: No mechanism for date transfer exists anywhere in the chain
next_action: Document root cause

## Symptoms

expected: When user selects "tomorrow" on Browse Vehicles and clicks a vehicle card, the BookingForm on VehicleDetail should default to tomorrow
actual: BookingForm always defaults to today (getToday()) and current hour (getNextFullHour())
errors: None -- silent logic gap, not an error
reproduction: Select tomorrow on Browse, search, click any vehicle card, observe BookingForm dates
started: Always been this way -- feature was never implemented

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-25
  checked: VehicleBrowse.tsx onNavigateToDetail callback (line 19, used at line 247)
  found: Callback signature is (vehicleId: number) => void -- only passes vehicle ID, no date information
  implication: Date/time state is trapped in VehicleBrowse component, never exposed

- timestamp: 2026-02-25
  checked: VehicleCard.tsx onSelect callback (line 9, line 16-18)
  found: onSelect(vehicle.id) -- only vehicle ID passed
  implication: Card click only carries vehicle ID

- timestamp: 2026-02-25
  checked: AppShell.tsx navigation handler (lines 103-126)
  found: onNavigateToDetail is (id: number) => setSelectedVehicleId(id). VehicleDetail receives no date props.
  implication: AppShell acts as router but has no date state to forward

- timestamp: 2026-02-25
  checked: VehicleDetail.tsx IVehicleDetailProps (lines 18-25)
  found: Interface has no date/time props. Only vehicleId, apiService, currentUserId, onBack, etc.
  implication: VehicleDetail has no way to receive initial dates from parent

- timestamp: 2026-02-25
  checked: BookingForm.tsx initial state (lines 94-100)
  found: startDate=getToday(), endDate=getToday(), startHour=getNextFullHour(), endHour=next+1
  implication: Form always defaults to "now" -- no mechanism to receive browse-page dates

- timestamp: 2026-02-25
  checked: BookingForm.tsx prefill mechanism (lines 105-118)
  found: useEffect watches prefillDate/prefillStartHour but these come from strip/timeline clicks within VehicleDetail, NOT from parent navigation
  implication: Prefill mechanism exists but is only wired for internal strip clicks, not cross-page navigation

## Resolution

root_cause: The navigation from VehicleBrowse to VehicleDetail only passes vehicleId (a number). The date/time selection state (startDate, endDate, startHour, endHour) lives entirely inside VehicleBrowse's local React state and is never forwarded. The full chain is: VehicleBrowse.handleCardSelect -> onNavigateToDetail(vehicleId) -> AppShell.setSelectedVehicleId(id) -> VehicleDetail receives {vehicleId} only. BookingForm then initializes with getToday()/getNextFullHour() hardcoded defaults.

fix: Not applied (diagnosis only)
verification: N/A
files_changed: []
