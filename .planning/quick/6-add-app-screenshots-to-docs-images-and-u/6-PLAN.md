---
phase: quick
plan: 6
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/images/browse-vehicles.png
  - docs/images/vehicle-detail-booking.png
  - docs/images/my-bookings.png
  - README.md
  - .gitignore
autonomous: true
requirements: []
must_haves:
  truths:
    - "Three screenshots exist in docs/images/ with descriptive English names"
    - "README Screenshots section displays all three images with captions"
    - "Original German-named screenshot files are removed from project root"
    - "Screenshot PNGs are not gitignored"
  artifacts:
    - path: "docs/images/browse-vehicles.png"
      provides: "Browse Vehicles view screenshot"
    - path: "docs/images/vehicle-detail-booking.png"
      provides: "Vehicle Detail & Booking view screenshot"
    - path: "docs/images/my-bookings.png"
      provides: "My Bookings view screenshot"
  key_links:
    - from: "README.md"
      to: "docs/images/browse-vehicles.png"
      via: "markdown image reference"
      pattern: "!\\[.*\\]\\(docs/images/browse-vehicles\\.png\\)"
    - from: "README.md"
      to: "docs/images/vehicle-detail-booking.png"
      via: "markdown image reference"
      pattern: "!\\[.*\\]\\(docs/images/vehicle-detail-booking\\.png\\)"
    - from: "README.md"
      to: "docs/images/my-bookings.png"
      via: "markdown image reference"
      pattern: "!\\[.*\\]\\(docs/images/my-bookings\\.png\\)"
---

<objective>
Move three app screenshots from project root to docs/images/ with proper English names, update the README Screenshots section to reference them with descriptive captions, and clean up the originals.

Purpose: Replace placeholder screenshot references in README with real app screenshots for the portfolio presentation.
Output: Three properly named screenshots in docs/images/, updated README section, no leftover files in root.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md (lines 25-36 — Screenshots section to replace)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move screenshots to docs/images with proper names</name>
  <files>docs/images/browse-vehicles.png, docs/images/vehicle-detail-booking.png, docs/images/my-bookings.png</files>
  <action>
Move the three German-named screenshot files from project root to docs/images/ with descriptive English names:

1. `mv "Bildschirmfoto 2026-03-01 um 15.33.52 (2).png" docs/images/browse-vehicles.png`
   — Browse Vehicles view: search filters with location dropdown, date range, time pickers, Search button

2. `mv "Bildschirmfoto 2026-03-01 um 15.35.04 (2).png" docs/images/vehicle-detail-booking.png`
   — Vehicle Detail and Booking view: Dacia Duster 2024 details, weekly availability grid, Book This Vehicle form

3. `mv "Bildschirmfoto 2026-03-01 um 15.36.29 (2).png" docs/images/my-bookings.png`
   — My Bookings view: Upcoming bookings tab with confirmed bookings and Cancel buttons

After moving, verify all three files exist in docs/images/ and originals are gone from root.

Also remove the docs/images/.gitkeep file since the directory now has real content.
  </action>
  <verify>
    <automated>ls -la docs/images/browse-vehicles.png docs/images/vehicle-detail-booking.png docs/images/my-bookings.png && test ! -f "Bildschirmfoto 2026-03-01 um 15.33.52 (2).png" && test ! -f "Bildschirmfoto 2026-03-01 um 15.35.04 (2).png" && test ! -f "Bildschirmfoto 2026-03-01 um 15.36.29 (2).png" && echo "PASS"</automated>
  </verify>
  <done>Three screenshots in docs/images/ with English names, original German-named files removed from project root, .gitkeep removed</done>
</task>

<task type="auto">
  <name>Task 2: Update README Screenshots section</name>
  <files>README.md</files>
  <action>
Replace README.md lines 25-35 (the Screenshots section content) with the three real screenshots and captions. Keep the `---` separator on line 36.

Replace the section with:

```markdown
## Screenshots

![Browse Vehicles](docs/images/browse-vehicles.png)
*Browse available vehicles with location, date range, and time filters*

![Vehicle Detail & Booking](docs/images/vehicle-detail-booking.png)
*View vehicle details, check weekly availability, and book directly*

![My Bookings](docs/images/my-bookings.png)
*Track upcoming and past bookings with quick actions*
```

Key changes:
- Replace the two placeholder image references with three real ones
- Remove the `> [!NOTE]` callout about screenshots being captured later
- Each image gets a descriptive alt text and italic caption underneath
- Keep blank line before the `---` separator after the section
  </action>
  <verify>
    <automated>grep -c "docs/images/browse-vehicles.png\|docs/images/vehicle-detail-booking.png\|docs/images/my-bookings.png" README.md | grep -q "3" && ! grep -q "Screenshots to be captured" README.md && ! grep -q "booking-view.png\|admin-dashboard.png" README.md && echo "PASS"</automated>
  </verify>
  <done>README Screenshots section shows all 3 real screenshots with descriptive captions, no placeholder references or NOTE callout remain</done>
</task>

</tasks>

<verification>
1. All three PNGs exist in docs/images/ with correct names
2. README references all three images correctly (relative paths render on GitHub)
3. No German-named files remain in project root
4. No placeholder text ("Screenshots to be captured") remains in README
5. `git diff` shows clean replacement of placeholder section
</verification>

<success_criteria>
- docs/images/ contains browse-vehicles.png, vehicle-detail-booking.png, my-bookings.png
- README Screenshots section displays three images with captions
- Original screenshot files removed from project root
- No stale references to booking-view.png or admin-dashboard.png in README
</success_criteria>

<output>
After completion, create `.planning/quick/6-add-app-screenshots-to-docs-images-and-u/6-SUMMARY.md`
</output>
