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
| **Fit plan** | Fits the plan to the room again after panning or zooming (Home does the same). |

**Moving around the plan** (the plan has working space around the room, so you can draw outside it)
- **Right-drag** (or middle-drag) pans. By default the view follows the cursor like a camera; **Settings → Mouse wheel in the plan** has a tick to make the drawing stick to the cursor instead.
- **Scroll** scrolls up and down; **Shift + scroll** scrolls sideways. **Settings → Mouse wheel in the plan** swaps this (wheel sideways, Shift up and down).
- **Ctrl + scroll** (or a touchpad pinch) zooms at the cursor, from 25% to 1200%. Snapping distances stay the same on screen as you zoom.
- Pan and zoom are not saved with the project or undone. **Home** or **Fit plan** resets them.

**Walls and rooms**
- Where a wall ends on another wall, the other wall is split there (a T-junction). Rooms are then **detected automatically from closed wall loops** and keep their names when walls move.
- Dragging a wall moves its whole straight run. Walls meeting it at 90° stretch to follow.
- Dragging a wall's square end, or typing a length in the Room panel, changes its length. Walls meeting that end at 90° move with it.
- **Shift-drag** a wall end to move that corner freely: the walls meeting there turn with it. The **Angle** field turns a wall about its start (0° = along x, 90° = along z).
- Objects dragged near an **angled wall** snap flush to its inside face. **Align to nearest wall** (inspector) turns the selection so its front faces into the room and pushes it against the wall.
- Doors, windows and fixtures keep their place in the room while walls move.
- Delete removes the selected wall along with its openings and fixtures.
- **Material**: each wall is **Concrete** (default, a solid line) or **Wood**. Wood has a style: *Slatted, vertical* or *horizontal* (slat width and gap), *Horizontal boards* (board height) or a *Plain panel*. It is drawn as a hollow strip with a tick per slat in the plan, as slat lines in the perspective (skipping door and window holes) and the elevations, and appears in the sheet's spec table with a slat count. **Use this material on all walls** copies it everywhere.
- **Lock walls** (button above the plan, or K): walls can't be dragged, resized, turned or deleted, and their length and angle fields are ignored, until unlocked. Drawing new walls still works.

**Doors and windows**
- **Lock** one (tick **Locked** in its settings) so it can't be dragged, resized or removed by accident.
- In the **perspective**, click a door or window outline to select it. Arrows appear: *along* the wall, and for a window also *up and down* to set the sill height (it snaps to the floor, other windows' sills and fixture heights; Alt is free). Its fields show in the Fixtures panel.
- Drag one along its wall. It snaps to wall ends, other openings and the grid; Alt is free.
- Drag its square ends to resize it.
- Doors have a hinge side, open into or out of the room, and have a swing angle. One door can be marked as the **entrance**, and **Reset view** starts the camera there.
- "Into the room" follows which side of the wall a room is on, so it works however the wall was drawn.

**Rotate the room** (Room panel): turn 90° left or right, or by any angle (degrees clockwise). Everything turns about the middle of the walls: walls, drawn rooms, reference lines, objects (and their group rotation), floor and ceiling fixtures, every saved scenario and the camera. Doors, windows, wall fixtures, fixtures on objects and objects attached to walls keep their anchors. Undo restores it. Walls must be unlocked. After a turn that isn't a multiple of 90° the walls are angled, so objects snap to wall faces rather than to the grid; **Align to nearest wall** still works.

**Reference lines** can be moved in any direction (**Shift** keeps a straight line on its own axis), resized by their ends, renamed and deleted from the plan or the Room panel. The selected line has **Size** (length, to 1 mm) and **Angle** fields, plus exact start and end points: typing the size keeps the start and moves the end.

**Camera**: drag the orange dot in the plan to move the perspective camera.

**Front of an object**: the selected object or preset shows a short glowing bar and arrow on its front edge in the plan (round shapes have none). The front is the side that **Align to nearest wall** turns towards the room.

**What it attaches to**: while an object is dragged, the readout names the wall, face or line it snaps to ("face · Desk"). With the Door, Window or Fixture tool, a label next to the cursor says what the click would attach to ("Outlet → wall 2 · 0.85 m along", or "nothing to attach to here").

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
  - **Mouse**: scroll zooms the lens (20–100°); **Shift + scroll** walks forward and back. **Hold the right button and move** to look around, up and down included. While it is held, **W A S D** fly and **Q / E** go down and up (Shift is faster). **Alt + right-drag** orbits the selection (or the room); **middle-drag** slides the camera sideways and up and down.
  - **Look up / down**: the camera has a pitch (−80° to +80°), a slider in the Camera panel, and Shift + ↑ / ↓. The horizon, vanishing points, ray picking, measuring and the paper frame all follow it. Reset view and the preset viewpoints level it again.
  - **Outside the room**: the camera may stand up to 3 m beyond the walls for a dollhouse view. When it is outside every room, the walls between it and the room are drawn faint and their openings are left out.
  - **Frame** (Camera panel, or Z): faces the selection and backs off until all of it is in the picture; with nothing selected it stands at the near end of the room and picks the narrowest lens that shows the room, so the room fills the view. In the plan, it fits the plan.
  - **Saved views**: **Save this view** keeps the camera (position, eye height, turn, look and lens) in a named list; Go returns to it. Saved views are part of the project and of Undo.
  - **Mini plan**: the button next to Lock camera hides the small plan beside the perspective so the drawing gets the full width. Fixtures are hidden in it to keep it clear (the selected one always shows); tick **Fixtures in the mini plan** in the Camera panel's Show list to see them.
- **Solid** (button, Show list, or S): objects hide the lines of whatever is behind them, so a desk reads as a solid block. The faces of every object and of the walls (with their door and window holes) go into a low-resolution depth buffer, and each line is then drawn only where it isn't behind a nearer face. There is no paint order, so overlapping objects and objects passing through each other hide correctly. It works in trace mode and with the Glow list. Lines closer than about 0.3% of their distance to a surface in front count as lying on it, so a very thin board's back edge can show through.
- **Image layers** (Layers panel): drop photos or sketches onto the drawing. You can move, resize, rotate, mirror and fade them, and show them over or under the lines.
  - **Corner pin**: drag the image's four corners to tilt it in depth (a rug photo onto the floor, say). It's a true perspective warp drawn with a small WebGL routine; without WebGL a grid of triangles approximates it. **Reset to flat** undoes the pin.
  - **Match camera**: on a room photo, drag two red lines onto floor lines that run the same way and two blue lines onto floor lines at right angles to them, and link each to the wall or reference line it lies on. **Solve and apply** sets the lens, turn, eye height and position from the vanishing points, and places the photo full width so the drawing lines up with it. Two parallel linked lines give the eye height; links in both directions give the position. A photo taken looking up or down sets the camera's look up / down to match; a rolled photo is turned level instead (the camera has no roll), so its verticals won't match exactly.
- **Paper frame** (button or `P`): shows an A4 or A3 sheet over the view with a 1 cm grid, for copying square by square.
  - The dotted floor line marks the depth where the picture is at the chosen scale (1:N). Things standing on that line measure true scale on the paper.
  - The label also gives the scale at the centre of the view.
  - **Print frame** (Camera panel) prints just the framed area on one sheet of the chosen paper, in light colours, with the 1 cm grid when it is on. The page is the paper size with no margin; print at 100% / actual size (no "fit to page") so the squares are 1 cm.

### Objects (both views)

- **Add**: a plain box, an extruded **Shape**, or a parametric preset, grouped by category. Editing a preset's parameters regenerates its parts; parts keep their identity by name, so fixtures and attached items survive the edit.
  - *Desks and tables*: Desk / table (legs + apron), L-desk (return on either side, optional rolling drawer module), Round table.
  - *Storage*: Bookshelf, Drawer unit, Cube shelf (columns × rows), Wall shelf with brackets, Wall cabinet with door lines, Corner shelf (rect), Corner shelf (triangle or quarter round), Storage stool, Rolling cart.
  - *Electronics*: Monitor on a VESA arm, PC tower, Cable tray, ESD mat.
  - *Seating and lighting*: Office chair (5-star base), Floor lamp.
  - Wall shelves and cabinets start on the back wall; things that stand on a desk start at desk height.
- **Extruded shapes**: any box can switch its footprint in the inspector (rectangle, corner triangle, quarter round, round, hexagon, 5-star). Picking, plan, snapping, resizing, measuring, clearances and the sheet all use the real outline. Nothing is tilted.
- **Group / Ungroup**: grouped boxes are selected and moved as one.
- **Attach to a wall** (the walls are listed in "Attached to"): the item keeps its place but now sits in the frame of that wall (along it, out from its face, and its angle to the wall). When the wall is moved, lengthened or turned, the item (and anything attached to it) goes with it. A preset group attaches part by part, so it stays rigid. Use **Align to nearest wall** first to turn it flush, then attach. This is how a VESA arm, a wall shelf or a cabinet stays on its wall. Moving it by hand keeps it attached; **Detach** or choosing Nothing frees it.
- **Attach** ("Attached to" in the inspector): a one-way parent link.
  - Moving or rotating the parent carries its children.
  - A child can still be selected and moved on its own.
  - Deleting a parent detaches its children and leaves them in place.
  - **Shift-drop**: start dragging, then hold Shift. The item lifts onto the top face of the box under its centre, and attaches to it when you release. Let go of Shift before releasing to cancel.
- **Lock**: locked items can't be moved, resized, rotated or deleted, and they can't be clicked on the drawing (clicks pass through to what's behind). Pick them in the Objects list to unlock them. Fixtures on a locked object are locked with it. Locked items still work as snap targets and as places to put fixtures.
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
| Power box | surface mounted, recessed | rectangle against the wall (to scale) with DB |
| Pipe (wall) | water 15 / 22 mm, drain 50 / 110 mm, vent / duct 100 mm, cable conduit 25 mm | ring on the wall line with a centre dot |
| Pipe (floor) | same | solid ring with a centre dot, x/z on the floor |
| Pipe (ceiling) | same | dashed ring with a centre dot, x/z on the ceiling |

- **Plate width**: each extra socket or gang adds 0.06 m.
- **Default tag**: fixtures default to the *Electrical* tag.
- **New fixtures**: copy the variant and height of the last fixture of the same type.
- **Other views**: elevations show the plate face, and perspective shows a flush plate with detail.
- **On an object**: a fixture can sit on a side face of an object (a power strip on a desk's apron, an outlet on a cabinet side). It moves and turns with the object, is copied with it and goes when it's deleted. Its height is measured from the object's base. Move it to another object or face, or back to a wall, with **On** and **Face** in its settings.
- **On top of an object**: with the Fixture tool, click inside an object (away from its edges) to put an outlet, switch, power strip or power box on its top surface; in a fixture's settings pick **Top surface** under Face (or in the perspective's Add panel). The position is an offset from the object's centre in its own axes, so it moves and turns with the object. Wall and ceiling lights and pipes can't go on top. Drag it in the plan, or with the x/z arrows in the perspective (they follow the cursor on the top plane).
- **Power box and pipes**: a power box is a plate-sized rectangle on a wall. A pipe or hole marks where something comes through: the variant sets the diameter (and the size of the mark); *Pipe (wall)* sits at a height on a wall, *Pipe (floor)* and *Pipe (ceiling)* are placed by x/z like a ceiling light. Pipes default to the built-in **Plumbing** tag. Change the Type in a fixture's settings to move it between wall, floor and ceiling.
- **Hide and show**: each fixture row (Room panel and perspective Fixtures panel) has an eye; **Show all** / **Hide all** sit above the list. Hidden fixtures disappear from the plan, perspective and sheet but stay in the list (greyed), so they can always be shown again.
- **Light coverage** (button next to Clearances, or I): ceiling lights draw a circle of 1.5 m and wall lights a half circle of 1.0 m in front of the wall, in the plan, and as rings on the floor in the perspective. Overlaps in the plan build up, so dark spots show. It's a rough reach, not a lighting simulation.
- **Lock**: wall and ceiling fixtures can be locked (tick **Locked** in its settings, or **Lock wall and ceiling fixtures** under the list) so they can't be dragged or deleted by accident. Fixtures on objects aren't locked; they follow their object.

### Sheet view

- **Page 1** is an SVG at true scale on the chosen paper (A4/A3, portrait or landscape, 1:10–1:100). It holds:
  - the plan,
  - one **elevation per chosen wall** (at any angle): looking at the wall from inside the room, showing what stands within the chosen depth of it, including fixtures on objects whose face points at you,
  - a title block, which names the active scenario and the ghost when one is shown.
- **Overflow**: anything that doesn't fit at the chosen scale gets a red outline and a warning; nothing is rescaled.
- **Below page 1**:
  - spec table (objects): name, tag, size, height range, notes,
  - **fixtures list**: every visible fixture grouped by type with counts and variants, numbered F1, F2… (the same numbers are written next to the fixtures on the plan and elevations), with where it is, its height, tag and notes. Hidden fixtures aren't listed; the numbers keep their place,
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
| | Look up / down | Shift+↑ / Shift+↓ |
| | Frame the selection (or the room; fits the plan in the plan view) | Z |
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
| | Lock walls | K |
| | Solid view (hide hidden lines) | S |
| | Tag colours | C |
| | Show clearances | Shift+C |
| | Show light coverage | I |
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

Mouse (not rebindable): plan — right-drag pans, wheel scrolls up and down, Shift + wheel sideways, Ctrl + wheel zooms. Perspective — wheel zooms the lens, Shift + wheel walks, right-drag looks around (with W A S D Q E to fly), Alt + right-drag orbits, middle-drag slides.

---

## Files (in load order)

Order matters: each file uses globals from the ones before it, and `ui.js` boots the app.

| File | Contents |
|---|---|
| `index.html` | Markup: header, view tabs, tool row, edit toolbar, canvases, sheet board, side panels, script tags |
| `css/app.css` | Theme tokens (light + dark), layout, panels, sheet and print styles |
| `docs/BACKLOG.md` | What's next; read at the start of each phase |
| `js/state.js` | State `S`, schema, defaults, `FX` fixture catalog, `migrate()`, history (`commit`/`undo`, `HKEYS`), selection, accessors, `corners`/`foot`/`aabb`/`bbox`, import/export |
| `js/geom.js` | Projection with yaw and pitch (`setupCam`), `camBounds`, polygon helpers, wood wall patterns (`wallPat`), `SHAPES` footprints, `hull`/`inFoot`, wall helpers (`wallU`/`wallN`/`wallP`/`wallIn`/`wallAng`/`doorGeom`), bounds, rotation (`normRot`/`quarterTurn`), preset regeneration, snapping (incl. angled wall faces, `alignToWall`) |
| `js/presets.js` | `PRESETS` catalog: parametric objects with `build()` and `cuts()` |
| `js/render.js` | Perspective drawing, solid view (`solidOrder`, `solidFill`, `solidEdges`), faded walls from outside, selected-box dimensions, object gizmo, box picking |
| `js/layers.js` | Image layers: drawing, on-canvas editing, IndexedDB storage, Layers panel |
| `js/warp.js` | Corner-pin: homography (`sqToQuad`, `m3inv`), `layerMap()`, WebGL warp with a 2D triangle fallback |
| `js/cammatch.js` | Camera matching: trace editing on the canvas, panel, `cmSolve()` from vanishing points, `cmApply()` |
| `js/plan.js` | Plan window (`PV` zoom/pan, `planXf`), plan drawing and pointer editing for objects and the camera |
| `js/interact.js` | Perspective pointer, shared drag end, edit actions, copy/paste, `ACTIONS`/`RUN` shortcuts |
| `js/nav.js` | Wheel, right/middle-drag and fly navigation in plan and perspective, `frameView()`, saved viewpoints |
| `js/attach.js` | Parenting: descendants, `selMove()`, attach/detach, wall frames (`wallFrameOf`, `placeOnWall`), Shift-drop, `cloneSet()` (copies fixtures on copied objects) |
| `js/scenarios.js` | Scenarios: capture/apply, switching, ghost overlay (`ghostObjs`, `GHOST`), Scenarios panel |
| `js/fixtures.js` | Fixture anchor `fxPlan()` (wall or object face), drawing (plan symbols, perspective plates, SVG), picking, perspective gizmo and drag, `nearestFace()` |
| `js/build.js` | Plan tools, point snapping (15° steps), wall graph (splitting, faces, room detection), wall/corner/opening/fixture/line dragging, Room panel, perspective Fixtures panel |
| `js/measure.js` | Measure tool (plan + ray picking), clearance zones and intrusion checks |
| `js/cutlist.js` | Cut list from preset `cuts()` |
| `js/paper.js` | Paper sizes/scales, perspective paper frame, paper controls, `printPaper()` |
| `js/sheet.js` | Sheet layout, plan/elevation SVG, spec table, notes editor, legend, print setup |
| `js/ui.js` | Views and panels, controls, inspector, object list, add buttons, tags, legend, trace highlight, New project dialog, shortcut settings, import/export, status line, sizing, `drawAll`/`renderAll`, boot |

---

## Data model (schema v8)

`S` holds the whole project. `migrate(raw)` accepts every earlier version (v0 boxes, v1 objects with a fixed room, v2 walls, v3, v4, v5) and returns a complete current state. v7 files load with nothing attached to walls and every fixture on a side face or wall as before. v6 files load with every door and window unlocked and fixtures hidden in the mini plan. v5 files load with concrete walls, a level camera, no saved views and solid off. v4 files load with every box plain and unturned (`poly: null`, `q: 0`), every fixture on its wall or the ceiling, every layer flat, and no scenarios. The steps for adding a field are under "Conventions for extending".

| Key | Shape |
|---|---|
| `walls` | `{id, a:[x,z], b:[x,z], h, type, style, sw, sg}`. Any angle. `h: null` means use the ceiling height. `type` is `'concrete'` or `'wood'`; for wood, `style` is `slats`, `hslats`, `boards` or `panel`, `sw` is the slat width (or board height) and `sg` the gap, in metres. |
| `openings` | `{id, wall, type:'window'\|'door', off, w, h, sill, hinge:'a'\|'b', side:±1, angle, entrance, locked}`. `off` is measured from the wall's `a` end to the opening's near edge; `side: 1` opens into the room. |
| `rooms` | `{id, name, pts:[[x,z]…], auto, drawn}`. `auto` rooms come from wall loops; `drawn` outlines are never changed by detection. |
| `marks` | Reference lines `{id, a, b, label}` |
| `objects` | `{id, n, x, y, z, w, d, h, rot, q, poly, vis, g, tag, notes, locked, parent, po, pw, pt, pn, pa, clr, clrLabel}`. x/y/z is the min corner and `rot` is yaw about the centre. `q` counts quarter turns, so `rot + 90·q` is the absolute yaw. `poly` is an extruded footprint as points normalised to w × d (0..1), or `null` for a box. `g` is the group id. `parent`/`po` are the attachment and its offset (refreshed on every commit). `pw`/`pt`/`pn`/`pa` attach it to a wall: wall id, distance along the wall from its start, distance out from its face to the object's centre, and yaw relative to the wall's front (all refreshed on every commit). `clr` is the clearance in metres. |
| `groups` | `{id, n, vis, preset, tag, notes, rot, locked, clr, clrLabel}`. `preset = {type, p, rot}` for parametric groups. |
| `fixtures` | `{id, type, v, n, wall, obj, face, top, off, y, x, z, tag, notes, vis, locked}`. With `top` set (needs `obj`) the fixture sits on the object's top surface and `x`/`z` are its offset from the object's centre in the object's own axes. `type` is `outlet`, `switch`, `wlight`, `clight`, `strip`, `powerbox`, `pipe`, `pipef` or `pipec` (floor and ceiling fixtures use x/z). Wall fixtures use `wall`/`off` (to the centre)/`y` (centre height). Object fixtures use `obj`/`face` (edge index of the footprint)/`off`/`y` (up from the object's base). Ceiling fixtures use `x`/`z`. `v` is the variant key. `locked` applies to wall and ceiling fixtures. |
| `tags` | `{id, name, c:[light, dark]}` |
| `notes` | Sheet notes: `[{id, title, items:[{id, text, verify}]}]` |
| `layers` | Image layer metadata (pixels live in IndexedDB). `pin`: four corners in canvas-width units, or `null` when flat. `cm`: camera-match traces `{lines, on, res}` in the layer's own 0..1 rectangle. |
| `scenarios` | `[{id, name, grp:{gid:{x0,y0,z0,rot,vis}}, pos:{oid:{cx,cz,y,a,vis}}}]`, plus `scenario` (active id) and `ghost` (id shown dashed) |
| `sheet` | `{title, elev:[{wall, flip}], depth, init}` |
| `paper` | `{size:'A4'\|'A3', orient, scale, persp, grid}` |
| `views` | Saved viewpoints `[{id, name, cx, cz, eye, yaw, pitch, fov}]` |
| view settings | `cx, cz, eye, yaw, pitch, fov, ceil, view, panels, snap, guides, grid, labels, trace, traceHL, lockCam, lockWalls, solid, miniPlan, fxMini, colorTags, hiddenTags, showClr, showLight` (`traceHL` = list of `'tag:…'`, `'kind:…'`, `'item:g:…'`, `'item:b:…'` that glow in trace mode; `pitch` in degrees, positive looks up). Plan zoom and pan are not stored. |

Two internals worth knowing:
- `normRot()` keeps `rot` in [0°, 90°). Each quarter turn taken out swaps `w` and `d`, adds 1 to `q`, turns the footprint polygon and moves fixtures on the box's faces to the face that now sits in the same place. 180° turns are exact, not dropped.
- The plan selection (`psel`: wall, opening, fixture, line or room) is separate from the object selection (`sel`). Only one of them is set at a time.

---

## Conventions for extending

- **New preset**: add an entry to `PRESETS` with `label`, `category`, `tag`, `defaults`, `fields`, `fix(p)`, `build(p)` and optionally `cuts(p)`, `wall: true` (start on the back wall) and `y0(p)` (starting height). Fields are `[key, label, 'm' | '#']` or `[key, label, 'opt', [[value, label], …]]`. A part with `poly` is an extruded shape (see `SHAPES`). Give parts stable, unique names so edits keep their identity. The Add panel and the cut list pick it up automatically.
- **New fixture type or variant**: edit `FX` in `state.js`, set `n` (sockets/gangs), `k` (kind) and optionally `d` (diameter, for round marks) on the variant; `ceil`/`floor` anchor a type by x/z, `r` gives it a Light coverage reach, `round` draws it as a circle; and draw it in `fxDetail()`, `fxSymbol()` and `fxSvgPlan()` in `fixtures.js`.
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
- Fixtures on objects sit on side faces or the top surface; there is no underside, and top fixtures don't appear on the sheet elevations (they are in the fixtures list and on the plan).
- Room rotation turns scenario layouts by applying each scenario to a copy, so scenarios that include parts of a group at different heights keep them, but an item a scenario doesn't know stays where it is.
- The camera has no roll, so camera matching turns a rolled photo level instead (it says so).
- Solid view hides lines with a depth buffer at reduced resolution, so a hidden line can leak a pixel or two at the edge of what hides it, and a board thinner than about 0.3% of its distance from the camera shows its back edge. Floors and ceilings don't hide anything.
- The Wall cabinet's Shelves count only feeds the cut list; the carcass is drawn closed.
- A perspective has no single scale. The paper frame's scale holds only at the dotted depth line.
- The sheet doesn't rescale drawings that overflow the page; it flags them instead.
- Image layers stay in the browser that added them and are not part of exports.

---

## Status

Phases 1–3 are built: plan, perspective and sheet; rooms, openings, fixtures, attachments, clearances and cut list; image corner-pin, angled walls, the object catalog and extruded shapes, scenarios, camera matching and fixtures on objects. Later additions: fixture locking, the perspective Fixtures panel, New project and the trace Glow picker. Pass 3 added fixtures on top surfaces, objects attached to walls and room rotation. Pass 2 added the Sheet fixtures list, fixture visibility, the power box and pipe fixtures and Light coverage. Pass 1 of the later round added locked doors and windows, window height in the perspective, locks that carry over to fixtures, click-through locked objects, the front mark and the "attaching to" label. Phase 4 added plan pan and zoom, perspective mouse look, pitch, orbit, flying, framing and saved viewpoints, solid view, wall materials, lock walls and Print frame.

What's next lives in `docs/BACKLOG.md`. A **Polish** pass with collected cosmetic tweaks happens at the end; add items to the backlog rather than fixing them one by one.

---

Linewright · built with the help of Claude by Anthropic.
