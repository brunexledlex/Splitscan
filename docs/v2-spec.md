# v2 — immersive capture UI

Working spec for the mobile UI/UX rework. Nothing here is implemented yet.

Status: **draft for review.** Four decisions at the bottom need answering before
implementation, because they change the shape of the work.

---

## 1. What this changes about v1

v1 is a *darkroom instrument*: a letterboxed canvas between a solid top rail and
a solid control deck, in a bespoke warm-black/safelight-amber identity, with the
image always accumulating and one export path (PNG at 900px on the long edge).

v2 is a *camera*: full-bleed viewport, translucent floating chrome, an explicit
idle → scanning → export cycle, and two real export formats. That is a rewrite
of the shell and the export path. **The scan geometry itself is untouched** —
`stepSweep`, `stepRadial`, `stepStrip` and the span-painting logic all survive
as-is.

| Area | v1 | v2 |
|---|---|---|
| Layout | canvas letterboxed between solid bars | canvas 100% bleed, chrome floats over it |
| Identity | bespoke darkroom instrument, SF type | Material Design 3, Material Symbols |
| Lifecycle | always accumulating | Idle → Scanning → Export |
| Export | one PNG, 900px long edge | HD 1920×1080, or continuous strip ≤5000px |
| Slice width | linear whole units 1…60 | quantised 1/2/4/8/16, full range under Advanced |
| Strip buffer | fixed canvas, shifted left each frame (history discarded) | segmented buffer, history retained |

---

## 2. Conflicts to resolve

### 2.1 H/V toggle vs. the premise of the project

The spec asks for a **toggle between horizontal and vertical scanning**. v1's
entire reason for existing is that the slit is at an *arbitrary, animatable
angle* — the original brief was "several shapes of slitscans beyond the usual
vertical/horizontal… angled, and rotating." A two-way toggle is strictly less
capable than the 0–360° control that exists today.

**Proposal:** keep the continuous angle as the primary control, and express
H/V as **snap presets on it** — chips for `0° · 45° · 90° · free`, plus a
direction-reversal control. You get the one-tap horizontal/vertical the spec
asks for, without throwing away angled and rotating. The angle strip stays the
always-visible control it became in v1.

### 2.2 The 1/2/4/8/16 slider is *not* the speed control that was just removed

"Slice extraction frequency in 1,2,4,8,16 px" describes **slice thickness** —
that is the existing `width` control (`Slit` in Sweep, `Blade` in Radial, `Rate`
in Strip), currently stepping in whole units. Quantising it to powers of two
with an Advanced reveal is a refinement of a control that still exists.

It is **not** a request to restore the *speed* slider (travel px/s, spin °/s)
that was removed a commit ago — those remain fixed constants. Flagging so this
isn't read as undoing that change. If the travel/spin rate should also come
back, that is a separate call.

### 2.3 "Continuous strip ≤5000px" only means Strip mode

Sweep and Radial paint into a **fixed canvas the size of the frame** — they do
not grow, so there is no strip to cap. Only Strip mode accumulates without
bound. So the export sheet is context-dependent:

- **Strip** → HD *or* Continuous strip
- **Sweep / Radial** → HD only (continuous is meaningless, and should be hidden
  rather than shown disabled)

### 2.4 Full-bleed canvas vs. the source's aspect ratio

"Canvas occupies 100% of the screen" and "export 1920×1080" are in tension with
a portrait phone screen (~9:19.5). Three options:

| | Behaviour | Cost |
|---|---|---|
| **A. Cover-crop** | accumulate at screen aspect, crop the camera feed | you never see what the 16:9 export will clip |
| **B. Fit** | letterbox, as v1 | contradicts "100% of screen" |
| **C. Accumulate 16:9, display cover-cropped, frame guides in HUD** | full-bleed *and* honest about the export frame | slight complexity in the HUD |

**Recommended: C.** The viewport fills the screen, and a subtle 16:9 guide in
the scan-line overlay shows what the HD export will actually contain. This is
what a real camera app does.

### 2.5 Material Symbols must be inlined, not linked

This is an **offline PWA**. Pulling Material Symbols from the Google Fonts CDN
would add a network dependency and break the offline promise (and a CSP-strict
host would drop it silently). The icons are Apache-2.0 licensed and available as
SVG.

**Proposal:** inline the ~8 needed glyphs as SVG paths in the document. No
network, no FOUT, no font file. Variant to confirm — **Sharp** is the assumed
default (see decision 4).

Also worth saying plainly: M3 on iPhone will not feel iOS-native. That is a
legitimate choice for a camera app, but it does replace the bespoke identity
documented in [DESIGN.md](../DESIGN.md), so that document will need revising
alongside.

---

## 3. Layout structure

Full-bleed canvas, chrome floating over it, all touch targets ≥48×48dp.

```
┌─────────────────────────────────────────┐
│ ░░ TOP BAR — translucent, safe-area top  │  scrim: surface @ 45% + blur
│ ░ RADIAL · 128°        [cameraswitch] ░ │  status readout is mono, tabular
│ ░ 1240 px buffer            [tune]    ░ │  buffer line only while scanning
├─────────────────────────────────────────┤
│                                         │
│                                         │
│          LIVE VIEWPORT                  │  canvas#acc  — the artwork
│          100% bleed                     │  canvas#hud  — scan line, bezel,
│                                         │                16:9 export guide
│        ╌╌╌╌╌╌ scan line ╌╌╌╌╌╌          │
│                                         │  one-finger drag anywhere here
│                                         │  → manual drive
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ ░ ANGLE  ▁▂▃▄▅▆▇ 128° ▇▆▅▄▃▂▁         ░ │  always visible, scrubbable
│ ░                                     ░ │
│ ░  [aspect_ratio]  ( ● )  [download]  ░ │  shutter 72dp, others 48dp
│ ░░ BOTTOM BAR — translucent, safe-area  │
└─────────────────────────────────────────┘
```

### Component tree

```
app
├── viewport                        100vw × 100dvh
│   ├── canvas#acc                  accumulation buffer
│   ├── canvas#hud                  scan line · bezel · 16:9 export guide
│   └── gesture-layer               pointer capture, beneath chrome
│
├── top-bar                         floating · translucent · safe-area
│   ├── status-readout              mode · angle · buffer length
│   ├── icon-button  cameraswitch   flip camera
│   └── icon-button  tune           → settings sheet
│
├── bottom-bar                      floating · translucent · safe-area
│   ├── angle-strip                 continuous angle, always visible
│   └── action-row
│       ├── icon-button  aspect_ratio      → export-format sheet
│       ├── shutter-button                 fiber_manual_record | stop
│       └── icon-button  download          → export sheet
│
├── sheet:settings                  M3 bottom sheet + scrim
│   ├── geometry-segmented          Sweep | Radial | Strip
│   ├── direction-chips             0° · 45° · 90° · free   + reverse
│   ├── slice-segmented             1 · 2 · 4 · 8 · 16 px
│   ├── disclosure "Advanced"
│   │   ├── slice-slider            full range for the geometry
│   │   ├── blades-segmented        1–4          (Radial only)
│   │   └── pivot-reset             recentre the pivot
│   └── guides-switch
│
├── sheet:export
│   ├── format-option  HD 1920×1080
│   ├── format-option  Continuous strip      (Strip mode only)
│   ├── buffer-readout                       current px / 5000 cap
│   └── actions  save · share · discard
│
└── snackbar                        M3, replaces the v1 toast
```

Icon mapping, per the brief:

| Action | Symbol |
|---|---|
| Start scan | `fiber_manual_record` |
| Stop scan | `stop` |
| Settings | `tune` |
| Export | `download` |
| Format switcher | `aspect_ratio` |
| Camera flip | `cameraswitch` |

---

## 4. States

### Idle
Camera live, **nothing accumulating**. The viewport shows the raw feed so you
can frame the shot. Scan line visible but parked. This is new — v1 starts
accumulating the instant it opens.

- Shutter: `fiber_manual_record`
- Settings and camera flip available; export disabled
- → **Scanning** on shutter

### Live Scanning
Accumulating. The image builds under the scan line.

- Shutter: `stop`
- Buffer length appears in the top bar; in Strip mode it counts toward 5000
- One-finger drag on the viewport → **manual drive** (sub-state; auto resumes
  on release, or stays manual until tapped — see decision 3)
- → **Export** on shutter, or automatically when the strip cap is reached
- Geometry changes here clear the buffer, as they do in v1

### Export / Preview
Accumulation frozen; the full artifact is shown rather than the viewport crop —
long strips are pannable and zoom-to-fit.

- Format sheet: HD, or Continuous (Strip only)
- Save (share sheet on iOS), Share, or Discard
- → **Idle** on discard or after save

```
        ┌──────── shutter ────────┐
        ▼                         │
     ┌──────┐   shutter    ┌────────────┐  shutter / cap reached   ┌────────┐
     │ IDLE │ ───────────► │  SCANNING  │ ───────────────────────► │ EXPORT │
     └──────┘              └────────────┘                          └────────┘
        ▲                    │        ▲                                 │
        │                    │ drag   │ release                         │
        │                    ▼        │                                 │
        │              ┌──────────────────┐                             │
        │              │ SCANNING·MANUAL  │                             │
        │              └──────────────────┘                             │
        └──────────────── discard / after save ───────────────────────-─┘
```

---

## 5. Buffer architecture

### The problem with v1's Strip mode

```js
sx.drawImage(acc, 0, 0);          // copy whole canvas
ax.drawImage(scratch, -adv, 0);   // blit it back, shifted left
```

That is a full-canvas copy **every frame**, and pixels shifted off the left edge
are gone. It is both the heaviest path in the app and the reason a continuous
strip is impossible today — history is destroyed as it scrolls.

### Proposed: segmented buffer

Accumulate into a list of fixed-width canvas segments instead of one scrolling
canvas.

```
segments: [ Canvas(1024×H), Canvas(1024×H), Canvas(1024×H), … ]
                                              ▲
                                         write head
```

- Each frame writes **only the new slice** into the active segment — no
  full-canvas blit at all. The per-frame cost stops scaling with buffer length.
- When a segment fills, push it and allocate the next.
- The viewport composites only the segments intersecting the visible window.
- Export concatenates segments into one canvas, clipped to the cap.

```js
const SEG_W = 1024;
const CAP   = 5000;

function advance(px){
  if (totalWidth + px > CAP) return onCapReached();   // policy, see below
  if (headX + px > SEG_W) segments.push(newSegment()), headX = 0;
  drawSliceInto(segments.at(-1), headX, px);
  headX += px; totalWidth += px;
}
```

**Sweep and Radial keep a single fixed canvas** — they overwrite in place and
never grow. The segmented path is Strip-only.

### Cap policy at 5000px

The brief says "stops recording **or** compresses buffer". These behave very
differently and it should be a setting, defaulting to the predictable one:

| Policy | Behaviour | Use |
|---|---|---|
| **Stop** *(default)* | halt at 5000px, transition to Export, snackbar | predictable; you get what you saw |
| **Ring** | drop oldest segments, keep the most recent 5000px | long ambient scanning |
| **Compress** | downscale the buffer 2:1 and carry on at half rate | maximum duration, visibly softens |

### Resolution: decouple three things

v1 conflates them at 900px. v2 needs them separate:

| | What | Size |
|---|---|---|
| **Capture** | video frame sampled | 1280×720 ideal from the camera |
| **Accumulate** | the artwork buffer | 1920×1080 for HD; H=1080 × growing W for strips |
| **Display** | what's on screen | viewport px, cover-cropped from the buffer |

**Measured.** Per-frame cost, forcing a GPU pipeline drain (`getImageData`)
before stopping the clock, so this is raster time and not just JS submit cost:

| Geometry | 900px (0.46 MP) | 1920px (2.07 MP) | % of 16.7ms budget |
|---|---|---|---|
| Radial | 0.157 ms | 0.139 ms | 0.8% |
| Sweep | 0.127 ms | 0.102 ms | 0.6% |
| Strip | 0.177 ms | 0.177 ms | 1.1% |

**Cost does not scale with resolution** — 4.5× the pixels for the same time.
That is not a fluke, it is structural: each frame paints only a *thin slice*
(a clipped wedge or band), so painted area scales with slit width × canvas
dimension, not with canvas area. Accumulating at 1920×1080 is therefore close to
free, and the 720p fallback contemplated above is unnecessary.

Two caveats worth keeping honest:

- These are desktop-GPU numbers. An iPhone has less fill rate — but at ~1% of
  frame budget there is roughly two orders of magnitude of headroom, so the
  conclusion survives a large margin of error. Still worth re-measuring on
  device once v2 runs.
- **Strip is the exception and the warning.** It is flat only because its
  full-canvas ping-pong blit is a cheap GPU texture copy here. That blit *does*
  scale with buffer size, and it is precisely what the segmented buffer removes.
  It is both the slowest path today and the one that would degrade worst as
  strips get longer.

### iOS canvas limits

Safari caps total canvas *area*, not just side length. 5000×1080 = 5.4 MP, well
inside the limit, and ~21.6 MB as RGBA. Safe — but the segmented design keeps
each individual canvas small anyway, which is the more robust posture. Allocation
should be guarded and degrade to a lower cap rather than throwing.

---

## 6. Decisions — settled

All four resolved in favour of the recommendations:

1. **Angle control** — the continuous 0–360° control stays primary. H/V arrive
   as snap presets on it (`0° · 45° · 90° · free`) plus a reverse control.
   Angled and rotating are not sacrificed.
2. **Full-bleed** — option C. Accumulate at 16:9, display cover-cropped to fill
   the screen, and draw a framing guide in the HUD showing what the HD export
   will actually contain.
3. **Manual drive** — one-finger drag on the viewport, as today. Springs back to
   auto on release by default, with a latch for sustained manual work.
4. **Icons** — Material Symbols **Sharp**, inlined as SVG paths. No CDN.

"vertical (top-to-bottom / bottom-to-bottom)" read as bottom-to-**top**.

### 6.1 Overriding constraint added

> "the goal is to have button commands on the bottom bar replaced with on-screen
> buttons and actions as much as possible"

This outranks the bottom-bar layout sketched in §3. The bar is no longer a place
to put things — it is a residue, holding only what genuinely cannot live on the
image. Every command must justify staying in chrome rather than justify moving
out of it.

Consequences that follow immediately:

- The **angle strip** in §3's bottom bar is redundant. Dragging the image
  already sets the angle, and the bezel already displays it. It goes.
- **Accidental input becomes the dominant risk.** Once the whole viewport is a
  control surface, a stray thumb during a scan costs you the shot. Every
  on-canvas gesture needs either a deliberate entry (long-press, two-finger) or
  a cheap undo.
- **Discoverability becomes the dominant cost.** Gestures that replace visible
  buttons must be taught — momentary affordances, a first-run pass, or
  handles drawn into the HUD that read as grabbable.

§3's component tree is therefore superseded by the scheme chosen in §7.

---

## 7. Chosen scheme — the ghosted barrel

Three schemes were generated against deliberately different lenses and scored on
brief fit, one-handed reach, discoverability, accidental-input safety and
buildability.

- **Hardpoints** — 48dp pucks bolted to the mechanism. Only moved 9 commands
  truly on-canvas and scattered 13 more into floating edges: a bar broken into
  pieces, not removed. Also needed two rendering families (canvas + DOM) for
  things that look like siblings.
- **Ghost Ring** — one finger the picture, two fingers the machine, long-press
  marking menu. **Disqualified by its own analysis:** two-finger gestures are
  two-handed on a phone; its long-press collides with the drag that is this
  app's signature interaction; and Safari has ignored `user-scalable=no` since
  iOS 10, so its pinch can zoom the page out from under it.
- **The Barrel** — build the whole app into the tick ring. 17 commands
  on-canvas, no bar and no rail, and the most buildable because it extends the
  HUD bezel that already exists.

**Winner: The Barrel**, with two grafts.

Its fatal flaw was occlusion — a permanent 256px tick ring sitting on top of the
abstract artwork you are trying to judge. The fix is Ghost Ring's best idea:
**the instrument ghosts to near-invisible when untouched and blooms under the
thumb.** Measured mean HUD alpha 26.6 idle → 87.3 while dragging → 26.4 after
release. From Hardpoints, real DOM buttons for the discrete actions, because a
canvas-drawn control is invisible to VoiceOver.

All three independently flagged one thing worth recording: **iOS Safari has no
`navigator.vibrate`.** Every detent must be visual; designing around haptics
would have produced feedback that silently does not exist.

### What actually shipped in `v2.html`

Chrome is five controls: a readout pill, camera-flip and settings top-right, and
source / shutter / export in the dock. Everything else is on the image or in a
sheet.

| | |
|---|---|
| Buffer | viewport aspect, 1920 long edge — **no display crop at all** |
| HD export | 1920×1080, centre-cropped, with a dashed 16:9 guide in the HUD |
| Strip export | 5000 × **1080** — 5.4 MP / 20.6 MB |
| Auto-stop | fires at 4992px and hands off to Export |
| Touch targets | 0 of 31 controls below M3's 48dp minimum |

**Strip height is 1080, not the viewport's 1920.** Matching the viewport would
have made a 5000×1920 buffer — 9.6 MP, 38 MB — crowding iOS Safari's canvas area
ceiling for no visible gain, since the strip is displayed scaled anyway.
Allocation is probed by writing a pixel at the far edge and reading it back: an
over-limit canvas allocates successfully and then reads blank, so a bare
try/catch would not catch it.

### Still open

- The camera path is unverified on a real device, as in v1.
- The segmented-canvas design in §5 was **not** built. A single wide history
  buffer achieves the same two goals — no per-frame full-canvas blit, history
  retained — with far less machinery. Segments remain the right answer only if
  the cap ever needs to exceed one canvas.
- No first-run teaching pass yet. Every scheme's authors agreed this is where
  gesture-led interfaces fail, and the drag gesture is currently undiscoverable
  except via the hint line in the settings sheet.
