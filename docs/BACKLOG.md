# Linewright — backlog

Read this at the start of each phase. Tick items off (or delete them) when done.

## Phase 2 (folded into the Phase 2 prompt) — done
- [x] Doors and windows in the plan: drag along their wall with the same feel as objects (snap to wall ends, other openings, grid; Alt for free), and resize with end handles.
- [x] Reference lines like END: add, move, rename and delete them in the plan, at any position. They act as snap targets (already the case for existing ones).

## Polish (one pass at the end)
- Wall cabinet: the Shelves count only feeds the cut list (the carcass is drawn closed).
- Camera matching assumes a level camera (the app has no pitch/roll); tilted photos are placed with the horizon on the centre line and the tilt is reported.

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
