# Phase 3: Core Booking Flow - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Employees can find an available vehicle at their location and book it with hourly precision, with the system preventing double-bookings and displaying all times correctly for the vehicle's location timezone. Employees can view and cancel their own bookings. Calendar views, check-in/out, suggestions, and admin oversight are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Vehicle search & filtering
- Card grid layout, 2-3 cards per row on desktop, 1 on mobile
- Each card shows: vehicle photo, make/model/year, category badge, capacity, license plate, availability indicator
- Inline filters above results (always visible): location, date/time range, category
- Employee's location auto-detected from Entra ID profile and pre-selected as default filter
- Employee can change location filter to browse other sites

### Time selection & booking
- Date picker for start/end dates + hour dropdown (8:00, 9:00, etc.) for time selection
- Subtle timezone label near time fields showing vehicle location timezone (e.g., "(EET)" or "(Europe/Bucharest)")
- All displayed times are in the vehicle's location timezone regardless of employee's browser timezone
- Review step before confirming: summary shows vehicle, dates/times, location, timezone with "Confirm Booking" button
- On booking conflict (race condition): error message "This slot was just booked by someone else" + refresh availability view

### My Bookings view
- Three tabs: Upcoming, Active, Past
- Each booking entry shows: vehicle photo thumbnail, make/model, license plate, category, start/end datetime, location name
- Upcoming bookings have a cancel button with confirmation dialog ("Are you sure?")
- Empty state: friendly message "No bookings yet" with "Book a Vehicle" action button navigating to search

### Vehicle detail page
- Full page with back navigation to search results
- Large hero image at top (full-width vehicle photo)
- Below photo: all specs (make, model, year, plate, category, capacity, location)
- Mini availability strip showing booked vs free times for the next 7 days
- Inline booking form (date/time pickers + "Book" button) on the same page below specs

### Claude's Discretion
- Loading skeleton designs
- Exact spacing, typography, and card styling
- Error state handling and retry patterns
- Availability strip visual design and interaction details
- Animation/transition between search results and detail page

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-core-booking-flow*
*Context gathered: 2026-02-23*
