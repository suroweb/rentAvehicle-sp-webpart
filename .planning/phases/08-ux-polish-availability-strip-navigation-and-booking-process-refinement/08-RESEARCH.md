# Phase 8: UX Polish — Availability Strip Navigation and Booking Process Refinement - Research

**Researched:** 2026-02-25
**Domain:** Frontend UX polish — SPFx/React 17/Fluent UI v8 component refactoring, CSS layout, mobile responsive patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Strip Navigation:**
- Add left/right arrow buttons for week-by-week navigation on the Week View strip
- Strip auto-centers on the booking form's selected start date when a date is picked (bidirectional sync)
- Manual arrows still work independently when no form date is selected
- Highlight today's column with a subtle accent border or background tint; highlight disappears when navigating past today
- Free slots on the strip are clickable — clicking a green hour pre-fills the booking form with that date + hour
- Day View (AvailabilityTimeline) also gets arrow navigation (day-by-day) alongside its existing DatePicker

**Detail Page Layout (Desktop):**
- Side-by-side layout: availability strip/timeline on the left, booking form in a sticky right panel
- Vehicle photo becomes a compact inline thumbnail alongside Make/Model/Year and specs (no more 300px hero)
- Booking form panel is always visible on desktop (not collapsible)
- After booking confirmation: green success MessageBar at top, form resets, availability strip refreshes to show the new booking slot as booked

**Booking Form Interaction:**
- Click-to-book from strip: clicking a free slot sets start date+hour, end defaults to start+1 hour. Dropdowns remain as manual fallback
- Keep the 3-step flow: selection → review → submitting (booking a company vehicle warrants confirmation)
- Conflict suggestions stay as inline suggestion cards below the conflict MessageBar with clear "Use this slot" / "View vehicle" CTAs (polish existing, not redesign)
- Visual warning when selected time overlaps a red (booked) slot on the strip — "This slot appears booked" warning, but still allow submit (backend is source of truth)

**Past Date/Time Prevention:**
- DatePickers set minDate = today across all components (form, strip, timeline)
- Hour dropdowns hide past hours when today is selected
- Strip and timeline gray out past slots as non-clickable
- Default form values: start date = today, start hour = current hour rounded up to next hour, end = start + 1 hour

**Mobile Experience:**
- Day View on mobile: simplified single-vehicle view with swipe to switch vehicles, hourly slots shown vertically (no 800px wide grid)
- Detail page on mobile: stacked layout with compact sticky bottom bar showing selected date/time and a "Book" action
- Tapping the sticky bottom bar opens a slide-up panel (bottom sheet) with the full booking form, dismissible by swiping down
- Week View strip hour blocks increase to larger touch targets on mobile (minimum 44px per Apple/Google guidelines), may limit visible hours to business hours (8-18) to fit

### Claude's Discretion
- Exact animation/transition for the mobile slide-up panel
- Arrow button styling and placement on strip/timeline
- Exact column highlight color for "today" marker
- Loading states during strip navigation (shimmer vs spinner)
- How to handle edge case when strip navigation reaches today (prevent navigating to past weeks)
- Day View mobile: exact swipe gesture implementation and vehicle-switching indicator

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Summary

This phase is a pure frontend UX refactoring of the existing VehicleDetail page and its child components (AvailabilityStrip, AvailabilityTimeline, BookingForm). The backend already has the required API endpoints — `getVehicleAvailability(vehicleId, days)` and `getLocationTimeline(locationId, date)` — which need only a minor extension (startDate parameter) to support week navigation. The core work is restructuring the VehicleDetail layout from a vertical stack to a side-by-side desktop layout with sticky form panel, adding arrow navigation to both strip and timeline, implementing bidirectional sync between the strip and the booking form, building a CSS-based mobile bottom sheet (Fluent UI v8 Panel does not support bottom positioning), and comprehensive past-time prevention.

The existing codebase is well-structured for this refactoring. The AvailabilityStrip already uses `getNextDays(count)` which can be extended to accept a start offset for week navigation. The BookingForm already handles `prefillDate` and `prefillStartHour` props from the timeline. The `useResponsive` hook provides `isMobile` detection at 768px. The main complexity lies in: (1) the side-by-side layout restructuring with CSS Grid/Flexbox, (2) the mobile bottom sheet which must be a custom CSS component since Fluent UI v8 Panel only supports left/right panels, (3) bidirectional sync state management between strip and form, and (4) the mobile Day View rewrite from CSS Grid to a vertical slot list with swipe gestures.

**Primary recommendation:** Restructure VehicleDetail into a responsive two-column layout using CSS Flexbox. Build the mobile bottom sheet as a custom component using CSS `transform: translateY()` transitions and `position: fixed` — do not try to use Fluent UI Panel for bottom positioning. Add a `startDate` query parameter to the `getVehicleAvailability` backend endpoint to support week navigation without fetching from "now" every time.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 17.0.1 | UI framework (exact pin required, React 18 breaks SPFx 1.22) | SPFx 1.22 requirement |
| @fluentui/react | ^8.106.4 | UI components: IconButton, DatePicker, Dropdown, Spinner, MessageBar, Pivot, Overlay | SPFx blessed library, v9 has rendering issues in SPFx |
| CSS Modules | built-in | Component-scoped styling via `*.module.scss` | SPFx Heft build system default |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useResponsive hook | custom | Mobile breakpoint detection at 768px | All responsive branching |
| useTimezone hook | custom | Timezone-aware date/time formatting | All date display and UTC conversion |
| localToUtcIso utility | custom | Convert local date+hour to UTC ISO string | BookingForm submission |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS bottom sheet | Fluent UI v8 Panel | Panel only supports left/right positioning (PanelType enum: smallFixedFar, smallFixedNear, medium, large, etc.). No bottom position. Must build custom. |
| Custom swipe detection | react-swipeable or hammer.js | Adding dependencies to SPFx increases bundle size and may conflict with Heft build. Touch event handlers are sufficient for single-axis horizontal swipe. |
| CSS scroll-snap for mobile Day View | Custom scroll handler | scroll-snap is well-supported (Chrome 69+, Safari 11+, all Teams webview targets) and provides native momentum scrolling |

### Installation
No new packages needed. All work uses existing dependencies.

## Architecture Patterns

### Current VehicleDetail Layout (vertical stack)
```
VehicleDetail (max-width: 900px, vertical stack)
├── backNav
├── heroImage (300px)
├── vehicleTitle (h2)
├── successBar (conditional)
├── specsSection (2-col grid)
├── Pivot (week/day toggle)
│   ├── AvailabilityStrip (7-day, slots from API, display-only)
│   └── AvailabilityTimeline (day view, CSS Grid 800px+ wide)
└── BookingForm (max-width: 500px, 3-step flow)
```

### Target VehicleDetail Layout (side-by-side)

**Desktop (>768px):**
```
VehicleDetail (full width, CSS Flexbox row)
├── Left Column (flex: 1 1 auto)
│   ├── backNav
│   ├── compactVehicleHeader (thumbnail + name + specs inline)
│   ├── successBar (conditional)
│   ├── Pivot (week/day toggle)
│   │   ├── AvailabilityStrip (with arrow nav, clickable free slots, today highlight)
│   │   └── AvailabilityTimeline (with arrow nav alongside DatePicker)
│   └── overlapWarning (conditional, when selected slot overlaps booked)
└── Right Column (flex: 0 0 360px, position: sticky, top: 24px)
    └── BookingForm (always visible, 3-step flow)
```

**Mobile (<768px):**
```
VehicleDetail (stacked, full width)
├── backNav
├── compactVehicleHeader (thumbnail + name + specs)
├── successBar (conditional)
├── Pivot (week/day toggle)
│   ├── AvailabilityStrip (larger touch targets 44px, business hours only)
│   └── AvailabilityTimeline (mobile: vertical slot list, swipe between vehicles)
├── StickyBottomBar (position: fixed, bottom: 0, shows date/time + "Book" CTA)
└── BottomSheet (slide-up panel with BookingForm, CSS transform animated)
```

### Pattern 1: Bidirectional Strip-Form Sync
**What:** Strip clicks fill the form; form date changes scroll the strip. State lifted to VehicleDetail.
**When to use:** Any time two sibling components need synchronized state.
**Implementation:**

```typescript
// VehicleDetail manages the sync state
const [weekOffset, setWeekOffset] = React.useState<number>(0); // 0 = current week
const [selectedSlot, setSelectedSlot] = React.useState<{date: Date; hour: number} | undefined>(undefined);

// Strip click → fills form
const handleStripSlotClick = React.useCallback(function onStripClick(
  dayDate: Date, hour: number
): void {
  setSelectedSlot({ date: dayDate, hour: hour });
  // BookingForm receives these as props, applies via useEffect
}, []);

// Form date change → shifts strip
const handleFormDateChange = React.useCallback(function onFormDateChange(
  date: Date
): void {
  // Calculate which week offset contains this date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (86400000));
  const targetWeek = Math.floor(diffDays / 7);
  setWeekOffset(targetWeek);
}, []);
```

### Pattern 2: Week Navigation with API Call
**What:** Arrow buttons shift the strip's week window. The API is called with a start date offset.
**When to use:** Strip left/right navigation.
**Implementation:**

The current API `getVehicleAvailability(vehicleId, days)` always starts from "now". For week navigation, add an optional `startDate` parameter:

```typescript
// Backend: add startDate query param to existing endpoint
// GET /api/vehicles/{id}/availability?days=7&startDate=2026-03-03
const startDateParam = request.query.get('startDate');
const rangeStart = startDateParam ? new Date(startDateParam + 'T00:00:00Z') : new Date();

// Frontend: ApiService extension
public async getVehicleAvailability(
  vehicleId: number,
  days?: number,
  startDate?: string  // YYYY-MM-DD format
): Promise<IVehicleAvailabilitySlot[]> {
  const params = new URLSearchParams();
  if (days !== undefined) params.append('days', String(days));
  if (startDate) params.append('startDate', startDate);
  return this.get<IVehicleAvailabilitySlot[]>(
    '/api/vehicles/' + String(vehicleId) + '/availability?' + params.toString()
  );
}
```

### Pattern 3: Custom CSS Bottom Sheet (Mobile)
**What:** A slide-up panel for the booking form on mobile, since Fluent UI v8 Panel lacks bottom positioning.
**When to use:** Mobile detail page booking form.
**Implementation:**

```scss
// BottomSheet.module.scss
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.overlayVisible {
  opacity: 1;
  pointer-events: auto;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  border-radius: 12px 12px 0 0;
  max-height: 85vh;
  overflow-y: auto;
  z-index: 1001;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  padding: 16px;
  padding-bottom: 32px; // safe area
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

.sheetOpen {
  transform: translateY(0);
}

.dragHandle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #c8c6c4;
  margin: 0 auto 16px;
}
```

```typescript
// BottomSheet component (React 17, no JSX — use React.createElement for consistency)
interface IBottomSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

const BottomSheet: React.FC<IBottomSheetProps> = function BottomSheet(props) {
  const touchStartY = React.useRef<number>(0);

  const handleTouchStart = React.useCallback(function onTouchStart(e: React.TouchEvent): void {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = React.useCallback(function onTouchEnd(e: React.TouchEvent): void {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) { // swipe down threshold
      props.onDismiss();
    }
  }, [props.onDismiss]);

  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      className: props.isOpen ? styles.overlay + ' ' + styles.overlayVisible : styles.overlay,
      onClick: props.onDismiss,
    }),
    React.createElement('div', {
      className: props.isOpen ? styles.sheet + ' ' + styles.sheetOpen : styles.sheet,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
      React.createElement('div', { className: styles.dragHandle }),
      props.children
    )
  );
};
```

### Pattern 4: Sticky Bottom Bar (Mobile)
**What:** A fixed bar at the bottom showing current selection and "Book" button.
**When to use:** Mobile detail page, always visible.

```scss
.stickyBottomBar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: #ffffff;
  border-top: 1px solid #edebe9;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
}

.stickyBottomBarText {
  font-size: 13px;
  font-weight: 500;
  color: $color-text-primary;
}
```

### Pattern 5: Past-Time Filtered Hour Options
**What:** When today is selected, hide hours that have already passed from the hour dropdown.
**When to use:** BookingForm, AvailabilityStrip click-to-book, all hour dropdowns.

```typescript
// Generate filtered hour options
function getFilteredHourOptions(selectedDate: Date): IDropdownOption[] {
  const now = new Date();
  const isToday = selectedDate.getFullYear() === now.getFullYear()
    && selectedDate.getMonth() === now.getMonth()
    && selectedDate.getDate() === now.getDate();

  if (!isToday) return HOUR_OPTIONS;

  const currentHour = now.getHours();
  const filtered: IDropdownOption[] = [];
  for (let i = 0; i < HOUR_OPTIONS.length; i++) {
    if ((HOUR_OPTIONS[i].key as number) > currentHour) {
      filtered.push(HOUR_OPTIONS[i]);
    }
  }
  return filtered;
}
```

### Pattern 6: Mobile Day View — Vertical Slot List with Swipe
**What:** Replace the 800px CSS Grid with a single-vehicle vertical hour list on mobile. Swipe left/right to switch vehicles.
**When to use:** AvailabilityTimeline on mobile (<768px).

```typescript
// Mobile vertical layout: one vehicle at a time, hourly rows
// Touch swipe detection using touchStart/touchEnd
const handleTouchStart = React.useCallback(function onTouchStart(e: React.TouchEvent): void {
  touchStartRef.current = e.touches[0].clientX;
}, []);

const handleTouchEnd = React.useCallback(function onTouchEnd(e: React.TouchEvent): void {
  const deltaX = e.changedTouches[0].clientX - touchStartRef.current;
  if (Math.abs(deltaX) > 50) { // swipe threshold
    if (deltaX < 0 && activeVehicleIndex < vehicles.length - 1) {
      setActiveVehicleIndex(activeVehicleIndex + 1); // swipe left = next
    } else if (deltaX > 0 && activeVehicleIndex > 0) {
      setActiveVehicleIndex(activeVehicleIndex - 1); // swipe right = prev
    }
  }
}, [activeVehicleIndex, vehicles.length]);
```

### Anti-Patterns to Avoid
- **Fluent UI v8 Panel for bottom sheet:** Panel only supports left/right positioning. Do not try to style-override it to slide from bottom — it will fight the component's internal layout and animation logic.
- **Using React.createElement for JSX-heavy components:** The existing codebase mixes JSX (VehicleDetail, BookingForm) with React.createElement (AvailabilityTimeline). Prefer JSX for new components as VehicleDetail and BookingForm use it. Only maintain React.createElement in AvailabilityTimeline if refactoring it entirely.
- **Adding external swipe libraries (hammer.js, react-swipeable):** These add bundle size and may not work with SPFx Heft bundler. Native touch event handlers are sufficient for single-axis horizontal swipe.
- **requestAnimationFrame-based animations:** CSS transitions via `transform` and `transition` are GPU-accelerated and simpler. No need for JS-driven animation loops.
- **useRef for form state sync:** The bidirectional sync between strip and form should use lifted state in VehicleDetail (useState + callbacks), not refs. Refs bypass React's rendering cycle and will cause stale UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mobile bottom sheet | Fluent UI Panel hack | Custom CSS component with transform/transition | Panel has no bottom positioning; CSS transitions are native, GPU-accelerated, and simpler |
| Sticky positioning | Custom scroll listener | CSS `position: sticky` | Native browser sticky is smoother, handles edge cases, no JS overhead |
| Touch swipe detection | Full gesture library | touchStart/touchEnd delta calculation | Only need single-axis horizontal swipe; 15 lines vs 30KB library |
| Hour filtering for past times | Complex date math | Simple `getHours()` comparison when isToday | Date is already decomposed into date + hour in the form model |
| Today column highlight | JavaScript DOM manipulation | CSS class toggle based on date comparison in React render | React manages DOM; class toggle is the standard pattern |

**Key insight:** This phase is 100% frontend refactoring using existing patterns. The temptation is to reach for external libraries (animation, gesture, component libs), but SPFx's Heft bundler and React 17 constraint mean native browser APIs (CSS transitions, touch events, position: sticky, scroll-snap) are both safer and more performant.

## Common Pitfalls

### Pitfall 1: position: sticky not working inside overflow: auto container
**What goes wrong:** The BookingForm sticky panel doesn't stick because a parent has `overflow-y: auto`.
**Why it happens:** CSS `position: sticky` requires ALL ancestors between it and the scroll container to NOT have `overflow: hidden/auto/scroll`. The current `.contentArea` has `overflow-y: auto`.
**How to avoid:** The sticky form panel must be a direct child of the scroll container, or the scroll container must be the VehicleDetail's own left column — NOT the AppShell's `.contentArea`. Structure the two-column layout so the left column scrolls independently while the right column uses `position: sticky` relative to the main content scroll.
**Warning signs:** Form panel scrolls with content instead of staying fixed on screen.

### Pitfall 2: API call storm on strip navigation
**What goes wrong:** Every arrow click triggers a `getVehicleAvailability` API call. Rapid clicking fires many concurrent requests.
**Why it happens:** No debounce or request cancellation on navigation.
**How to avoid:** Use a cancelled flag pattern (already used in VehicleDetail's useEffect). When weekOffset changes, cancel the previous request. Consider a brief delay (200-300ms) before firing the API call, or pre-fetch adjacent weeks.
**Warning signs:** Network tab shows many pending requests; strip flickers between loading and data states.

### Pitfall 3: CSS z-index conflicts with bottom sheet in SPFx
**What goes wrong:** The bottom sheet overlay or panel appears behind SharePoint chrome or Teams host elements.
**Why it happens:** SPFx webparts render inside SharePoint's DOM which has its own z-index stacking. Teams webview also has overlay elements.
**How to avoid:** Use z-index values in the 1000+ range for the bottom sheet (consistent with Fluent UI's Layer/Overlay pattern which uses z-index 1000000). Test in both SharePoint hosted workbench and Teams.
**Warning signs:** Overlay doesn't cover the full screen; bottom sheet appears behind navigation elements.

### Pitfall 4: Touch events conflicting with scroll in bottom sheet
**What goes wrong:** Swiping down to dismiss the bottom sheet also scrolls the content inside it.
**Why it happens:** Touch events bubble; both the dismiss handler and the scroll handler respond.
**How to avoid:** Only initiate dismiss swipe when touching the drag handle area at the top. If the sheet content is scrolled to top and user swipes down, then dismiss. Use `e.target` check or a dedicated drag handle element.
**Warning signs:** Cannot scroll long booking form in bottom sheet; or bottom sheet dismisses when trying to scroll.

### Pitfall 5: Week navigation losing form state
**What goes wrong:** When the user navigates the strip to a different week, the booking form resets.
**Why it happens:** If weekOffset is part of the useEffect dependency that re-fetches availability, and the form state is coupled to the availability state.
**How to avoid:** Keep form state (startDate, startHour, endDate, endHour) independent of strip navigation state. Only the availability data (slots array) should change on strip navigation. The form only updates when the user explicitly clicks a slot or changes the form fields.
**Warning signs:** User selects a time, navigates the strip to check availability, comes back, and their selection is gone.

### Pitfall 6: SPFx CSS Modules and dynamic class composition
**What goes wrong:** Trying to use template literals or string interpolation for conditional classes fails in SCSS modules.
**Why it happens:** SPFx CSS Modules hash class names. You must use the imported styles object.
**How to avoid:** Use string concatenation: `styles.base + (condition ? ' ' + styles.modifier : '')`. The project already uses this pattern consistently.
**Warning signs:** Classes appear as `undefined` in rendered HTML.

### Pitfall 7: Mobile bottom bar overlapping BottomTabBar
**What goes wrong:** The sticky booking bottom bar and the app's BottomTabBar (from AppShell) overlap at the bottom of the screen.
**Why it happens:** Both use `position: fixed; bottom: 0`.
**How to avoid:** The sticky booking bottom bar should sit above the BottomTabBar. Use `bottom: $bottom-bar-height` (56px) for the booking bar on mobile. The bottom sheet should also account for this.
**Warning signs:** Two bars stacked on top of each other; content hidden behind both.

## Code Examples

### Week Navigation State and API Integration
```typescript
// In VehicleDetail — manage strip navigation
const [weekOffset, setWeekOffset] = React.useState<number>(0);

// Compute the start date for the current week window
const weekStartDate = React.useMemo(function computeWeekStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(today.getTime() + weekOffset * 7 * 86400000);
}, [weekOffset]);

// Format for API
const weekStartStr = React.useMemo(function formatWeekStart(): string {
  const d = weekStartDate;
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}, [weekStartDate]);

// Fetch availability when week changes
React.useEffect(function loadWeekAvailability(): () => void {
  let cancelled = false;
  apiService.getVehicleAvailability(vehicleId, 7, weekStartStr)
    .then(function onSuccess(slots: IVehicleAvailabilitySlot[]): void {
      if (!cancelled) setAvailabilitySlots(slots);
    })
    .catch(function onError(): void { /* silently fail */ });
  return function cleanup(): void { cancelled = true; };
}, [vehicleId, weekStartStr, apiService]);

// Arrow handlers
const handlePrevWeek = React.useCallback(function onPrevWeek(): void {
  if (weekOffset > 0) setWeekOffset(weekOffset - 1);
}, [weekOffset]);

const handleNextWeek = React.useCallback(function onNextWeek(): void {
  setWeekOffset(weekOffset + 1);
}, [weekOffset]);
```

### Today Column Highlight in AvailabilityStrip
```typescript
// Inside dayColumns build loop
const today = new Date();
today.setHours(0, 0, 0, 0);

const isToday = dayDate.getTime() === today.getTime();
const columnClass = isToday
  ? styles.stripDayColumn + ' ' + styles.stripDayColumnToday
  : styles.stripDayColumn;
```

```scss
.stripDayColumnToday {
  background: rgba(0, 120, 212, 0.04);
  border: 1px solid rgba(0, 120, 212, 0.2);
  border-radius: 4px;
}
```

### Side-by-Side Desktop Layout
```scss
.vehicleDetailLayout {
  display: flex;
  flex-direction: row;
  gap: 24px;
  align-items: flex-start;
}

.leftColumn {
  flex: 1 1 0;
  min-width: 0; // prevent flex overflow
}

.rightColumn {
  flex: 0 0 360px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

@media (max-width: $mobile-breakpoint) {
  .vehicleDetailLayout {
    flex-direction: column;
  }

  .rightColumn {
    display: none; // Hidden on mobile — form is in bottom sheet
  }
}
```

### Compact Vehicle Header (replacing 300px hero)
```scss
.compactHeader {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.compactThumbnail {
  width: 80px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex: 0 0 80px;
}

.compactInfo {
  flex: 1 1 auto;
}

.compactTitle {
  font-size: 20px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 4px 0;
}

.compactSpecs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: $color-text-secondary;
}
```

### Overlap Warning (Strip vs Form)
```typescript
// Check if selected form time overlaps any booked slot on the strip
const overlapWarning = React.useMemo(function checkOverlap(): boolean {
  if (!startDate || startHour === undefined) return false;
  // Compare selected start/end against availabilitySlots
  // Use the same toComparableMinutes logic from AvailabilityStrip
  for (let i = 0; i < availabilitySlots.length; i++) {
    const slot = availabilitySlots[i];
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();
    const formStart = new Date(startTimeUtc).getTime();
    const formEnd = new Date(endTimeUtc).getTime();
    if (formStart < slotEnd && formEnd > slotStart) return true;
  }
  return false;
}, [availabilitySlots, startTimeUtc, endTimeUtc]);
```

### Backend: Add startDate Parameter to Availability Endpoint
```typescript
// In bookings.ts - getVehicleAvailabilityEndpoint
const startDateParam = request.query.get('startDate');
const daysParam = request.query.get('days');
const days = daysParam ? parseInt(daysParam, 10) : 7;

// Pass startDate to service
const slots = await getVehicleAvailability(id, days, startDateParam || undefined);

// In bookingService.ts - getVehicleAvailability
export async function getVehicleAvailability(
  vehicleId: number,
  days: number = 7,
  startDate?: string // YYYY-MM-DD format
): Promise<IVehicleAvailabilitySlot[]> {
  const pool = await getPool();
  const request = pool.request();

  const rangeStart = startDate
    ? new Date(startDate + 'T00:00:00.000Z')
    : new Date();
  const rangeEnd = new Date(rangeStart.getTime() + days * 24 * 60 * 60 * 1000);

  request.input('vehicleId', sql.Int, vehicleId);
  request.input('rangeStart', sql.DateTime2, rangeStart);
  request.input('rangeEnd', sql.DateTime2, rangeEnd);

  const result = await request.query(`
    SELECT startTime, endTime, status
    FROM Bookings
    WHERE vehicleId = @vehicleId
      AND status IN ('Confirmed', 'Active')
      AND startTime < @rangeEnd
      AND endTime > @rangeStart
    ORDER BY startTime
  `);

  return result.recordset;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS-driven animation (requestAnimationFrame) | CSS `transform` + `transition` for slide-up panels | Standard since 2020+ | GPU composited, 60fps, no JS thread blocking |
| External gesture libraries (hammer.js) | Native touch event handlers | React 16.8+ hooks era | Zero bundle cost, simpler debugging |
| Overlay with `position: absolute` | `position: fixed` + high z-index | CSS standard | Correct viewport coverage regardless of scroll position |
| Scroll-based sticky polyfills | Native CSS `position: sticky` | IE11 EOL 2022 | No polyfill needed for SPFx 1.22 targets |

**Deprecated/outdated:**
- `react-transition-group`: Unnecessary for simple CSS transition toggles; adds bundle weight for no benefit in this use case.
- View Transitions API (`React.ViewTransition`): React 19+ only, not available in React 17.

## Open Questions

1. **AvailabilityStrip: Week navigation boundary**
   - What we know: Left arrow should be disabled/hidden when weekOffset === 0 (cannot go to past weeks). Right arrow has no practical limit.
   - What's unclear: Should there be a maximum lookahead? (e.g., 12 weeks max?) The backend accepts any `days` and `startDate`, but showing availability 6 months out may not be useful.
   - Recommendation: Set a soft limit of 8 weeks lookahead (weekOffset max = 7). This is Claude's discretion per CONTEXT.md.

2. **Post-booking strip refresh: full re-fetch or optimistic update?**
   - What we know: CONTEXT.md says "availability strip refreshes to show the new booking slot as booked." Current behavior after booking success only sets `bookingSuccess = true` without refreshing availability.
   - What's unclear: Should we re-fetch from the API (consistent but adds latency) or optimistically add the new slot to the local state (instant but may miss concurrent bookings)?
   - Recommendation: Re-fetch from API. The current `handleConflict` callback already does this (`apiService.getVehicleAvailability`). Apply the same pattern to `handleBookingComplete` — re-fetch availability after success. This also ensures any concurrent bookings from other users are reflected.

3. **Mobile bottom sheet: safe area inset for iOS**
   - What we know: Teams mobile on iOS uses safe area insets. The bottom sheet needs `padding-bottom: env(safe-area-inset-bottom)`.
   - What's unclear: Whether SPFx webparts in Teams already handle safe area insets at the container level.
   - Recommendation: Add `padding-bottom: max(32px, env(safe-area-inset-bottom, 32px))` to the bottom sheet. This is a safe fallback — if safe area is handled by Teams container, the 32px minimum still provides comfortable padding.

## Sources

### Primary (HIGH confidence)
- **Project codebase** — Direct inspection of all source files listed in Architecture Patterns section
- **Existing API endpoint** `/api/vehicles/{id}/availability?days=7` — `bookingService.ts` lines 145-170 confirmed query structure
- **Fluent UI v8 Panel component** — Known from codebase inspection and verified: PanelType enum does not include bottom position (only smallFixedFar, smallFixedNear, medium, large, largeFixed, extraLarge, custom, customNear)
- **SPFx 1.22 / React 17.0.1 / Fluent UI ^8.106.4** — `package.json` confirmed exact versions

### Secondary (MEDIUM confidence)
- **CSS position: sticky** — MDN Web Docs standard, well-supported in all Teams webview targets
- **CSS transform transitions** — MDN Web Docs standard, GPU-composited in modern browsers
- **Touch events API** — MDN Web Docs standard, supported in all mobile browsers Teams targets

### Tertiary (LOW confidence)
- **env(safe-area-inset-bottom)** in SPFx Teams context — needs validation in actual Teams mobile environment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in the project, no new dependencies
- Architecture: HIGH — Direct inspection of every component being modified, clear patterns
- Pitfalls: HIGH — Based on known CSS/React behavior patterns validated against codebase structure
- Mobile patterns: MEDIUM — CSS bottom sheet pattern is well-established but untested in SPFx Teams mobile specifically

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable — no external dependencies or moving targets)
