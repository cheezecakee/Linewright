# Linewright

*Your space in clean lines: to scale, in perspective, on paper.*

Linewright (formerly Room Sketch Guide) draws your room to scale in three views:

- **Plan**: top-down. Build walls, rooms, doors, windows, fixtures and reference lines, and place furniture.
- **Perspective**: an eye-level view from a camera you place. Use it to check a layout, or trace it onto paper.
- **Sheet**: a printable drawing set at true scale, with plan, elevations, spec table, cut list, notes and tag legend.

It is plain HTML, CSS and JavaScript with `<canvas>` and inline SVG. There are no frameworks, no build step and no modules. The scripts are classic `<script src>` files, so the app also runs straight from `file://`.

Units are **metres** throughout. Coordinates: **x** to the right, **z** away from the window wall (down in the plan), **y** up from the floor.

---

## Running it

- **Locally**: open `index.html` in a browser. No server is needed.
- **As a claude.ai artifact**: the same files are published as a multi-file artifact.

The project saves itself automatically in the browser:

| What | Where |
|---|---|
| Project (walls, objects, notes, settings…) | `localStorage` key `rsg` |
| Custom keyboard shortcuts | `localStorage` key `rsg-keys` |
| Image layer pixels | IndexedDB database `rsg-layers` (only layer metadata is in the project) |

The keys keep the old `rsg` prefix from the Room Sketch Guide days, so projects saved before the rename still load. Old exported files import fine too.

**New** (header) clears the project and starts over, either with a room (4 × 5 m by default, any size you type) that has a window and an entrance door, or with nothing at all. Before it does, it offers **Export, then start new** so you keep a copy. Tags, shortcuts and settings stay, and Undo brings the previous project back until you close the page.

**Export** downloads the project as `linewright-YYYY-MM-DD.json` and also copies it to the clipboard. Inside the claude.ai artifact the download can be blocked, so the clipboard copy is the reliable one there. **Import** loads a `.json` file. You can also drop the file on the drawing, or paste the JSON in Settings. Import replaces the room and objects, keeps image layers, and can be undone. Images are never exported.

---

## Features

### Plan view

**Tools** (the row above the plan):

| Tool | How it works |
|---|---|
| **Select** | Click to select. Drag to move: objects snap to walls, faces, reference lines and the grid. Alt turns snapping off. |
| **Wall** | Click a start point, then click each corner. Directions snap to 15° steps (0° and 90° snap to alignment as before) and lengths to the grid; an existing corner near the cursor wins at any angle. A chain finishes when you click its start, land on an existing wall, press Enter or double-click. Alt draws freely. |
| **Room** | Draws a named floor outline by hand (a "drawn" room). Click the first point or press Enter to close it. |
| **Door / Window** | Click on a wall to add one. |
| **Fixture** | Pick the type in the dropdown next to the button, then click on a wall or on the side of an object (whichever is closer). A ceiling light can go anywhere in the room. |
| **Line** | Click two points to add a reference line (like `END`). Reference lines act as snap targets. |
| **Measure** | Click two points. |

**Walls and rooms**
- Where a wall ends on another wall, the other wall is split there (a T-junction). Rooms are then **detected automatically from closed wall loops** and keep their names when walls move.
- Dragging a wall moves its whole straight run. Walls meeting it at 90° stretch to follow.
- Dragging a wall's square end, or typing a length in the Room panel, changes its length. Walls meeting that end at 90° move with it.
- **Shift-drag** a wall end to move that corner freely: the walls meeting there turn with it. The **Angle** field turns a wall about its start (0° = along x, 90° = along z).
- Objects dragged near an **angled wall** snap flush to its inside face. **Align to nearest wall** (inspector) turns the selection so its front faces into the room and pushes it against the wall.
- Doors, windows and fixtures keep their place in the room while walls move.
- Delete removes the selected wall along with its openings and fixtures.

**Doors and windows**
- Drag one along its wall. It snaps to wall ends, other openings and the grid; Alt is free.
- Drag its square ends to resize it.
- Doors have a hinge side, open into or out of the room, and have a swing angle. One door can be marked as the **entrance**, and **Reset view** starts the camera there.
- "Into the room" follows which side of the wall a room is on, so it works however the wall was drawn.

**Reference lines** can be moved, resized by their ends, renamed and deleted from the plan or the Room panel.

**Camera**: drag the orange dot in the plan to move the perspective camera.

### Perspective view

- **Gizmo**: click a box edge to select it. Drag the coloured arrows to move along x, y or z. The square tips resize unrotated boxes and parametric presets.
- **Dimensions**: the selected box (or group) shows its width, depth and height along its edges.
- **Fixtures**: click a fixture's outline in perspective, or pick it in the mini plan or the **Fixtures** panel. Its settings open in the Fixtures panel, so you can edit any fixture (including ones on objects) without going back to the plan.
  - **Wall and object fixtures** get a two-axis gizmo: *along* the wall or face and *y* (height). Along snaps like in the plan. Height snaps to other fixtures' heights and to window sills and heads on the same wall; on an object it snaps to the object's base, middle and top.
  - **Ceiling lights** get *x/z* instead.
  - **Add a fixture** (Fixtures panel): pick the type and the object (or wall) to put it on, and the face. It lands in the middle of that face. Selecting an object first picks it for you.
- **Trace mode** has a **Glow** list next to the Trace button. Tick any mix of tags, kinds (Desks, Monitors on arm, Boxes, Fixtures…) and single items or groups, or use **Add selection**. Ticked items glow in their tag's colour while everything else turns faint, so they're easy to pick out while copying. Ticking anything turns trace mode on; **Clear** traces everything again.
- **Measure**: click two points or faces, found by ray picking. You get the distance and Δx/Δy/Δz, plus the face-to-face gap when both faces are parallel.
- **Camera**: use the sliders, the preset viewpoints and the arrow keys (see shortcuts). Trace mode draws heavy single-colour lines for copying. Lock camera stops accidental moves.
- **Image layers** (Layers panel): drop photos or sketches onto the drawing. You can move, resize, rotate, mirror and fade them, and show them over or under the lines.
  - **Corner pin**: drag the image's four corners to tilt it in depth (a rug photo onto the floor, say). It's a true perspective warp drawn with a small WebGL routine; without WebGL a grid of triangles approximates it. **Reset to flat** undoes the pin.
  - **Match camera**: on a room photo, drag two red lines onto floor lines that run the same way and two blue lines onto floor lines at right angles to them, and link each to the wall or reference line it lies on. **Solve and apply** sets the lens, turn, eye height and position from the vanishing points, and places the photo full width so the drawing lines up with it. Two parallel linked lines give the eye height; links in both directions give the position. The app's camera is level, so a tilted photo is reported and its verticals won't match exactly.
- **Paper frame** (button or `P`): shows an A4 or A3 sheet over the view with a 1 cm grid, for copying square by square.
  - The dotted floor line marks the depth where the picture is at the chosen scale (1:N). Things standing on that line measure true scale on the paper.
  - The label also gives the scale at the centre of the view.

### Objects (both views)

- **Add**: a plain box, an extruded **Shape**, or a parametric preset, grouped by category. Editing a preset's parameters regenerates its parts; parts keep their identity by name, so fixtures and attached items survive the edit.
  - *Desks and tables*: Desk / table (legs + apron), L-desk (return on either side, optional rolling drawer module), Round table.
  - *Storage*: Bookshelf, Drawer unit, Cube shelf (columns × rows), Wall shelf with brackets, Wall cabinet with door lines, Corner shelf (rect), Corner shelf (triangle or quarter round), Storage stool, Rolling cart.
  - *Electronics*: Monitor on a VESA arm, PC tower, Cable tray, ESD mat.
  - *Seating and lighting*: Office chair (5-star base), Floor lamp.
  - Wall shelves and cabinets start on the back wall; things that stand on a desk start at desk height.
- **Extruded shapes**: any box can switch its footprint in the inspector (rectangle, corner triangle, quarter round, round, hexagon, 5-star). Picking, plan, snapping, resizing, measuring, clearances and the sheet all use the real outline. Nothing is tilted.
- **Group / Ungroup**: grouped boxes are selected and moved as one.
- **Attach** ("Attached to" in the inspector): a one-way parent link.
  - Moving or rotating the parent carries its children.
  - A child can still be selected and moved on its own.
  - Deleting a parent detaches its children and leaves them in place.
  - **Shift-drop**: start dragging, then hold Shift. The item lifts onto the top face of the box under its centre, and attaches to it when you release. Let go of Shift before releasing to cancel.
- **Lock**: locked items can't be moved, resized, rotated or deleted.
- **Hide**: hides an item. Show it again with the eye icon in the Objects list.
- **Tags**: each item gets a tag. **Tag colours** colours items by tag, and its legend can hide a tag.
- **Copy / Paste / Duplicate**: these carry attached children along.
- **Clearance** (inspector): a zone around the item's footprint, with a name such as "chair recline".
- **Scenarios** (Objects panel): named layouts of the same room, such as "Work mode" and "Guest mode". **Save** stores the layout on screen under a new name and leaves the others alone; moves, turns and hiding after that belong to the active scenario and are kept when you switch. Sizes, names and the room are shared. The dashed-box button shows another scenario as a **ghost** (dashed outlines of what sits elsewhere there) in the plan, the perspective and on the sheet.

**Clearances** (toolbar, `Shift+C`) shows these zones, which come from three sources:
- every door's swing,
- each drawer unit's pull-out,
- any item given a clearance in the inspector.

Furniture inside a zone turns the zone red. It also adds a warning under the drawing and a count on the button.

**Cut list** (Objects panel and sheet): boards from preset groups. Identical sizes are merged and listed by thickness, with piece counts and area.

### Fixtures

| Type | Variants | Symbol in plan |
|---|---|---|
| Outlet | single, double, triple, high current (20 A), with USB, data (RJ45), TV/coax | circle with one stroke per socket; data = triangle, TV = "TV", USB adds "U" |
| Switch | 1-, 2-, 3-gang, two-way, dimmer | S / SS / SSS / Sw / Sd on a stub |
| Wall light | — | circle on a bracket |
| Ceiling light | — | circle with a cross |
| Power strip | 3, 4, 6 sockets | bar along the surface, one dot per socket |

- **Plate width**: each extra socket or gang adds 0.06 m.
- **Default tag**: fixtures default to the *Electrical* tag.
- **New fixtures**: copy the variant and height of the last fixture of the same type.
- **Other views**: elevations show the plate face, and perspective shows a flush plate with detail.
- **On an object**: a fixture can sit on a side face of an object (a power strip on a desk's apron, an outlet on a cabinet side). It moves and turns with the object, is copied with it and goes when it's deleted. Its height is measured from the object's base. Move it to another object or face, or back to a wall, with **On** and **Face** in its settings.
- **Lock**: wall and ceiling fixtures can be locked (tick **Locked** in its settings, or **Lock wall and ceiling fixtures** under the list) so they can't be dragged or deleted by accident. Fixtures on objects aren't locked; they follow their object.

### Sheet view

- **Page 1** is an SVG at true scale on the chosen paper (A4/A3, portrait or landscape, 1:10–1:100). It holds:
  - the plan,
  - one **elevation per chosen wall** (at any angle): looking at the wall from inside the room, showing what stands within the chosen depth of it, including fixtures on objects whose face points at you,
  - a title block, which names the active scenario and the ghost when one is shown.
- **Overflow**: anything that doesn't fit at the chosen scale gets a red outline and a warning; nothing is rescaled.
- **Below page 1**:
  - spec table: name, tag, size, height range, notes,
  - cut list,
  - project notes,
  - tag legend.
- **Project notes** are titled sections ("Guest modes", "Assumptions", …) edited directly on the sheet.
  - Enter adds an item, and Backspace on an empty item deletes it.
  - Any item can carry a **verify** mark.
- **Dimensions**: only stored values are shown (wall lengths, opening sizes). There is no automatic dimensioning.
- **Print sheet** sets the matching page size. Print at 100% (no "fit to page") to keep the scale.

---

## Keyboard shortcuts

All of these can be rebound in **Settings → Keyboard shortcuts**. `Mod` is ⌘ on Mac and Ctrl elsewhere.

| Group | Action | Default |
|---|---|---|
| Camera | Move forward / back | ↑ / ↓ |
| | Turn left / right | ← / → |
| | Step left / right | Shift+← / Shift+→ |
| | Raise / lower eye height | PgUp / PgDn |
| Objects | Delete selected | Delete |
| | Duplicate | D |
| | Rotate 90° / 15° | R / Shift+R |
| | Group / Ungroup | G / Shift+G |
| | Hide selected | H |
| | Lock / unlock selected | Shift+L |
| | Rename selected | F2 |
| | Deselect (also: finish drawing, leave the tool, clear the measurement) | Esc |
| View | Plan / Perspective / Sheet | 1 / 2 / 3 |
| | Reset view | Home |
| | Trace mode | T |
| | Lock camera | L |
| | Tag colours | C |
| | Show clearances | Shift+C |
| | Paper frame over perspective | P |
| Edit | Undo / Redo | Mod+Z / Mod+Shift+Z |
| | Copy / Paste | Mod+C / Mod+V |
| Tools | Select | V |
| | Draw walls / room outline | W / Shift+W |
| | Add door / window | O / Shift+O |
| | Add fixture | F |
| | Add reference line | E |
| | Measure | M |

Hold **Alt** while dragging to turn snapping off. **Enter** finishes a wall chain or room outline.

---

## Files (in load order)

Order matters: each file uses globals from the ones before it, and `ui.js` boots the app.

| File | Contents |
|---|---|
| `index.html` | Markup: header, view tabs, tool row, edit toolbar, canvases, sheet board, side panels, script tags |
| `css/app.css` | Theme tokens (light + dark), layout, panels, sheet and print styles |
| `docs/BACKLOG.md` | What's next; read at the start of each phase |
| `js/state.js` | State `S`, schema, defaults, `FX` fixture catalog, `migrate()`, history (`commit`/`undo`, `HKEYS`), selection, accessors, `corners`/`foot`/`aabb`/`bbox`, import/export |
| `js/geom.js` | Projection, polygon helpers, `SHAPES` footprints, `hull`/`inFoot`, wall helpers (`wallU`/`wallN`/`wallP`/`wallIn`/`wallAng`/`doorGeom`), bounds, rotation (`normRot`/`quarterTurn`), preset regeneration, snapping (incl. angled wall faces, `alignToWall`) |
| `js/presets.js` | `PRESETS` catalog: parametric objects with `build()` and `cuts()` |
| `js/render.js` | Perspective drawing, selected-box dimensions, object gizmo, box picking |
| `js/layers.js` | Image layers: drawing, on-canvas editing, IndexedDB storage, Layers panel |
| `js/warp.js` | Corner-pin: homography (`sqToQuad`, `m3inv`), `layerMap()`, WebGL warp with a 2D triangle fallback |
| `js/cammatch.js` | Camera matching: trace editing on the canvas, panel, `cmSolve()` from vanishing points, `cmApply()` |
| `js/plan.js` | Plan drawing and pointer editing for objects and the camera |
| `js/interact.js` | Perspective pointer, shared drag end, edit actions, copy/paste, `ACTIONS`/`RUN` shortcuts |
| `js/attach.js` | Parenting: descendants, `selMove()`, attach/detach, Shift-drop, `cloneSet()` (copies fixtures on copied objects) |
| `js/scenarios.js` | Scenarios: capture/apply, switching, ghost overlay (`ghostObjs`, `GHOST`), Scenarios panel |
| `js/fixtures.js` | Fixture anchor `fxPlan()` (wall or object face), drawing (plan symbols, perspective plates, SVG), picking, perspective gizmo and drag, `nearestFace()` |
| `js/build.js` | Plan tools, point snapping (15° steps), wall graph (splitting, faces, room detection), wall/corner/opening/fixture/line dragging, Room panel, perspective Fixtures panel |
| `js/measure.js` | Measure tool (plan + ray picking), clearance zones and intrusion checks |
| `js/cutlist.js` | Cut list from preset `cuts()` |
| `js/paper.js` | Paper sizes/scales, perspective paper frame, paper controls |
| `js/sheet.js` | Sheet layout, plan/elevation SVG, spec table, notes editor, legend, print setup |
| `js/ui.js` | Views and panels, controls, inspector, object list, add buttons, tags, legend, trace highlight, New project dialog, shortcut settings, import/export, status line, sizing, `drawAll`/`renderAll`, boot |

---

## Data model (schema v5)

`S` holds the whole project. `migrate(raw)` accepts every earlier version (v0 boxes, v1 objects with a fixed room, v2 walls, v3, v4) and returns a complete current state. v4 files load with every box plain and unturned (`poly: null`, `q: 0`), every fixture on its wall or the ceiling, every layer flat, and no scenarios. The steps for adding a field are under "Conventions for extending".

| Key | Shape |
|---|---|
| `walls` | `{id, a:[x,z], b:[x,z], h}`. Any angle. `h: null` means use the ceiling height. |
| `openings` | `{id, wall, type:'window'\|'door', off, w, h, sill, hinge:'a'\|'b', side:±1, angle, entrance}`. `off` is measured from the wall's `a` end to the opening's near edge; `side: 1` opens into the room. |
| `rooms` | `{id, name, pts:[[x,z]…], auto, drawn}`. `auto` rooms come from wall loops; `drawn` outlines are never changed by detection. |
| `marks` | Reference lines `{id, a, b, label}` |
| `objects` | `{id, n, x, y, z, w, d, h, rot, q, poly, vis, g, tag, notes, locked, parent, po, clr, clrLabel}`. x/y/z is the min corner and `rot` is yaw about the centre. `q` counts quarter turns, so `rot + 90·q` is the absolute yaw. `poly` is an extruded footprint as points normalised to w × d (0..1), or `null` for a box. `g` is the group id. `parent`/`po` are the attachment and its offset (refreshed on every commit). `clr` is the clearance in metres. |
| `groups` | `{id, n, vis, preset, tag, notes, rot, locked, clr, clrLabel}`. `preset = {type, p, rot}` for parametric groups. |
| `fixtures` | `{id, type, v, n, wall, obj, face, off, y, x, z, tag, notes, vis, locked}`. Wall fixtures use `wall`/`off` (to the centre)/`y` (centre height). Object fixtures use `obj`/`face` (edge index of the footprint)/`off`/`y` (up from the object's base). Ceiling fixtures use `x`/`z`. `v` is the variant key. `locked` applies to wall and ceiling fixtures. |
| `tags` | `{id, name, c:[light, dark]}` |
| `notes` | Sheet notes: `[{id, title, items:[{id, text, verify}]}]` |
| `layers` | Image layer metadata (pixels live in IndexedDB). `pin`: four corners in canvas-width units, or `null` when flat. `cm`: camera-match traces `{lines, on, res}` in the layer's own 0..1 rectangle. |
| `scenarios` | `[{id, name, grp:{gid:{x0,y0,z0,rot,vis}}, pos:{oid:{cx,cz,y,a,vis}}}]`, plus `scenario` (active id) and `ghost` (id shown dashed) |
| `sheet` | `{title, elev:[{wall, flip}], depth, init}` |
| `paper` | `{size:'A4'\|'A3', orient, scale, persp, grid}` |
| view settings | `cx, cz, eye, yaw, fov, ceil, view, panels, snap, guides, grid, labels, trace, traceHL, lockCam, colorTags, hiddenTags, showClr` (`traceHL` = list of `'tag:…'`, `'kind:…'`, `'item:g:…'`, `'item:b:…'` that glow in trace mode) |

Two internals worth knowing:
- `normRot()` keeps `rot` in [0°, 90°). Each quarter turn taken out swaps `w` and `d`, adds 1 to `q`, turns the footprint polygon and moves fixtures on the box's faces to the face that now sits in the same place. 180° turns are exact, not dropped.
- The plan selection (`psel`: wall, opening, fixture, line or room) is separate from the object selection (`sel`). Only one of them is set at a time.

---

## Conventions for extending

- **New preset**: add an entry to `PRESETS` with `label`, `category`, `tag`, `defaults`, `fields`, `fix(p)`, `build(p)` and optionally `cuts(p)`, `wall: true` (start on the back wall) and `y0(p)` (starting height). Fields are `[key, label, 'm' | '#']` or `[key, label, 'opt', [[value, label], …]]`. A part with `poly` is an extruded shape (see `SHAPES`). Give parts stable, unique names so edits keep their identity. The Add panel and the cut list pick it up automatically.
- **New fixture type or variant**: edit `FX` in `state.js`, set `n` (sockets/gangs) and `k` (kind) on the variant, and draw it in `fxDetail()`, `fxSymbol()` and `fxSvgPlan()` in `fixtures.js`.
- **New shortcut**: add `[id, label, defaultKey, group]` to `ACTIONS` and a handler to `RUN` in `interact.js`. The settings list builds itself from them.
- **New saved field**: bump `SCHEMA`, normalize the field in `migrate()`, add it to `HKEYS` if Undo should cover it and to `SCENE_KEYS` if Export should include it.
- **Drags**: set the global `drag` with a `view` of `'p'` or `'v'`. `endDrag()` commits if it moved and calls `drag.onEnd` first.
- **Redraw**: call `drawAll()`. Panels re-render through `renderSel()`, `renderRooms()` and `renderAll()`.
- **Checks**: concatenate the scripts in load order and run `node --check`.

---

## Known limitations

- Crossing walls with no shared end point aren't split.
- If a new wall splits an existing wall inside a doorway, the door is moved onto one of the two pieces.
- Shift-drop only uses top faces, and it goes by the centre of the dragged item.
- Fixtures on objects sit on side faces only (not on top surfaces).
- The camera has no pitch or roll, so camera matching treats a tilted photo as level (it says so).
- The Wall cabinet's Shelves count only feeds the cut list; the carcass is drawn closed.
- A perspective has no single scale. The paper frame's scale holds only at the dotted depth line.
- The sheet doesn't rescale drawings that overflow the page; it flags them instead.
- Image layers stay in the browser that added them and are not part of exports.

---

## Status

Phases 1–3 are built: plan, perspective and sheet; rooms, openings, fixtures, attachments, clearances and cut list; image corner-pin, angled walls, the object catalog and extruded shapes, scenarios, camera matching and fixtures on objects. Later additions: fixture locking, the perspective Fixtures panel, New project and the trace Glow picker.

What's next lives in `docs/BACKLOG.md`. A **Polish** pass with collected cosmetic tweaks happens at the end; add items to the backlog rather than fixing them one by one.

---

Linewright · built with the help of Claude by Anthropic.
