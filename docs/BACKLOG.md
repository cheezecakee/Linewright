# Linewright — backlog

Read this at the start of each phase. Tick items off (or delete them) when done.

## Phase 4 bugs found in testing
- [x] Solid view: an object grows huge when it is moved towards the camera, and wrong lines are hidden where objects overlap. (Reworked: the painter's fill is gone; a depth buffer now decides what is hidden. **Check in the browser**, especially objects near the camera and thin boards.)
- [x] Plan: the vertical and horizontal movement is inverted in the Plan tab. (Right-drag now moves the view like a camera, kept. The wheel was the real one: plain scroll is now up and down, Shift + scroll sideways; a setting restores the old mapping.)
- [x] Windows can't be moved vertically. (Select a window's outline in the perspective: arrows along the wall and up/down. Sill field also in the Fixtures panel.)

## Pass 1 (quick fixes) — built, to check in the browser
- [x] Locking doors and windows is allowed (Locked tick in their settings; locked ones can't be dragged, resized or removed). Schema v7.
- [x] Sheet print: no blank first page (everything but the sheet leaves the layout when printing).
- [x] Locking an object locks the fixtures on it; locked objects can't be clicked on the drawings (still pickable in the Objects list).
- [x] Fixtures are hidden in the mini plan (the selected one stays); **Fixtures in the mini plan** shows them again.
- [x] Front indicator on the selected object in the plan and mini plan.
- [x] "Attaching to…" text while placing fixtures, doors and windows, and in the drag readout for objects.

## Bugs fixed after pass 4
- [x] Office chair (and any preset with extruded or quarter-turned parts): rotating with the plan handle left the star base and wheels misaligned and spun them. The drag now restores the quarter-turn count, footprints and fixture faces on every step.
- [x] Scratchpad: dragging selected page text. The sheet drawing no longer allows text selection.

## Planned passes (agreed, not built)
- [x] **Pass 2, fixtures round (built, to check in the browser):** own fixtures list on the Sheet (grouped by type, numbered like the drawing); eye toggle per fixture plus show/hide all; powerbox fixture (surface and recessed); pipe/hole fixture (water, drain, vent, conduit; wall, floor and ceiling anchors); Light coverage overlay (plan circles, floor rings in perspective).
- [x] **Pass 3, structural (built, to check in the browser):** fixtures on top surfaces of objects (not hanging ones); objects attached to walls (VESA mount, wall shelves) with the wall anchoring; room rotation (90° steps first, then free angle; walls, rooms, objects, ceiling lights, scenarios).
- [x] **Pass 4 (built, to check in the browser):** Sheet scratchpad: lines, arrows, rectangles, text and dimension lines in sheet coordinates, saved with the project and printed. Share: link (gzip in the address), share sheet and file.
- [x] **Pass 5 (built, to check in the browser):** base catalog (seating, bedroom, desks, storage, electronics incl. VESA wall mount, kitchen, bathroom, decor, music; nine fixture types), category filter and search in the Add panel.
- [ ] **Later:** importable catalog packs (JSON with parametric parts), embedded in shared projects.
- [ ] Later: layer views (wires, plumbing, main structure) with per-layer visibility; needs a layer tag on fixtures/objects.

## Phase 4 — built, to check in the browser

### A. Bugs
- [x] Reference lines can't move horizontally, and their size can't be set precisely. Fix horizontal dragging, and add a **Size** (length) field to the selected reference line section (plan inspector / Room panel) so it can be typed there too. (Done: both ways, Shift keeps the axis; Size, Angle and 1 mm end points in the selected line.)
- [x] Ceiling light alignment is off in Perspective mode (the plate doesn't line up with its x/z position in the plan). (Dragging now follows the cursor on the ceiling plane. No static offset found in the code; **check in the browser** and say what still looks off.)

### B. Plan workspace and navigation
- [x] Bigger working space: the plan canvas limits how much room can be drawn; enlarge it (or make it effectively unbounded).
- [x] Plan navigation:
  - [x] Right mouse button hold + move pans the plan.
  - [x] Scroll wheel scrolls horizontally.
  - [x] Ctrl + scroll zooms in and out (around the cursor).
  - [x] Shift + scroll scrolls vertically.
  - [x] All of the above work while walls are locked (and don't move or edit anything). Also added a **Lock walls** toggle (K), in case "lock walls" was meant as a feature.

### C. Perspective camera
- [x] Make the room appear bigger by default so it's easier to see and edit (Frame room, Mini plan toggle for a full-width view).
- [x] Mouse in perspective:
  - [x] Scroll wheel zooms the camera in and out (lens; Shift + scroll walks).
  - [x] Right button hold + move looks around (yaw and pitch).
- [x] Camera ideas:
  - [x] Pitch (look up/down) in the camera; camera matching applies it.
  - [x] Middle-drag to slide the camera sideways/up.
  - [x] Fly with W/A/S/D/Q/E while the right button is held (plain W/D/S keys already have other jobs); Shift for faster.
  - [x] Frame the selection with Z or the Frame button (double-click still renames).
  - [x] Zoom to fit the whole room / the selection (same Frame action).
  - [x] Orbit around the selection or room centre (Alt + right-drag).
  - [x] Fade walls between the camera and the room when the camera is outside (camera may now stand up to 3 m outside).
  - [x] Saved viewpoints list.
- [x] Delete the **Like your sketch** viewpoint button (`index.html`, `sketch` preset in `state.js`).

### D. Other
- [x] Paper frame has no print button: add a **Print** button in the paper controls that prints the framed view at the chosen paper size and scale (check `@media print` in `css/app.css`).
- [x] Wall type: **Concrete** (default) or **Wood**. Wood gets a pattern choice such as slatted (slat width, gap, direction) and similar styles. Data model change: add `type` (and style params) to walls, bump `SCHEMA`, extend `migrate()`; drawn in plan, perspective and elevations; shows in the spec table.

### E. Solid mode
- [x] Solid view mode (cheap painter's version): nearer faces hide the lines behind them. Walls don't hide objects; a true hidden-line solver would be a later step.

## Phase 2 (folded into the Phase 2 prompt) — done
- [x] Doors and windows in the plan: drag along their wall with the same feel as objects (snap to wall ends, other openings, grid; Alt for free), and resize with end handles.
- [x] Reference lines like END: add, move, rename and delete them in the plan, at any position. They act as snap targets (already the case for existing ones).

## Polish (one pass at the end)
- Wall cabinet: the Shelves count only feeds the cut list (the carcass is drawn closed).
- Camera matching: pitch is now applied from the photo; roll is not (the photo is turned level and the roll is reported).

## Phase 3 — done
- [x] Image corner-pin (WebGL perspective warp, 2D fallback, Reset to flat), angled walls, object catalog + extruded shapes, scenarios with ghost overlay, camera matching (schema v5).
- [x] Fixtures attached to objects (power strip on a desk, outlet on a cabinet side): the fixture sits on a face of the object and moves/turns with it instead of belonging to a wall. Reuse the perspective fixture gizmo (along the face + height). Touches plan, perspective, elevations and the spec table.

## Small changes after Phase 3 — done
- [x] Lock wall and ceiling fixtures (per fixture, or all at once); locked ones can't be dragged or deleted.
- [x] Edit fixtures, including ones on objects, from the Perspective view (Fixtures panel), and add a fixture on a chosen object, face or wall.
- [x] New project: clears everything, offers Export first, can start with a rectangular room; Undo brings the old project back.
- [x] Trace mode Glow picker: one kind or tag glows, everything else turns faint.
- [x] Glow list: any mix of tags, kinds, items and groups, each glowing in its tag colour.
- [x] New project starts with a 4 × 5 m room with a window and an entrance door; credit line at the end of the README.
