# Anti-aliased slit-scan engine — understanding & impact

Analysis of the AA engine brief against the v2 codebase. Nothing implemented.
Five decisions at the bottom.

---

## 1. What the brief is actually asking for

Not a filter on the existing output. A **second rendering engine**, running a
different algorithm, switched on and off in settings.

The current engine paints a thin clipped slice of the **live** frame into a
persistent canvas, then forgets that frame forever. It holds no history at all.
Every requirement in §C — fractional spatial sampling, blending between frame
*N* and *N+1*, averaging across an exposure window — needs the **last N frames
still in memory**. Canvas 2D cannot do any of it: no fractional texture reads,
no control over filtering, no frame buffer.

So this is WebGL, alongside the 2D engine, not replacing it. The toggle the
brief asks for is exactly the right shape.

## 2. The artefact being targeted is real, and I can name its cause

The jagged stair-stepping in the current radial output is not a rendering bug —
it is inherent to how v1/v2 draw. Two separate quantisations:

- **Temporal.** Each frame paints one wedge from *one instant*. The output is
  therefore a series of discrete time bands with hard edges between them. Faster
  motion means bigger jumps between adjacent bands.
- **Spatial.** The wedge is `clip()`-ed, so its edges land on hard pixel
  boundaries with no fractional coverage.

§C.1 and §C.2 address exactly these two, in that order. The brief is
well-aimed.

## 3. The big one: this changes what "slit-scan" means in this app

| | v2 engine | AA engine |
|---|---|---|
| Model | **accumulate** — build an image up over real time | **time-displacement** — re-render the whole frame every tick |
| Source of pixels | the live frame, once | a rolling buffer of the last N frames |
| Output over time | slowly fills in, destructive, one-way | continuously alive, non-destructive |
| Time axis | "when the slit passed here" | "how far into the past this pixel looks" |

In the AA engine, for every output pixel the shader computes a time offset from
the slit geometry, samples the history buffer at that **fractional** depth, and
blends across the exposure window. The whole image is alive and re-rendered each
frame — you are looking through a warped window into the recent past rather than
watching a picture get built.

That is almost certainly what you want, and it is more capable. But it means:

- **"Hold" changes meaning.** There is nothing to pause; the buffer keeps
  rolling. Hold becomes freeze-the-buffer.
- **Idle → Scanning → Export needs rethinking.** There is no "accumulating"
  phase — the effect is visible the instant the buffer fills. Scanning becomes
  closer to "recording", and Export is a snapshot of a live image.
- Scrubbing becomes possible for free, which the accumulate model can never do.

## 4. Memory is the binding constraint, and 30–600 frames does not fit

This is the finding that most affects the brief. A frame buffer costs
`depth × width × height × 4` bytes:

| History res | Per frame | 30 frames | 120 | 300 | **600** |
|---|---|---|---|---|---|
| 1920×1080 | 8.29 MB | 249 MB | 995 MB | 2.49 GB | **4.98 GB** |
| 1280×720 | 3.69 MB | 111 MB | 442 MB | 1.11 GB | **2.21 GB** |
| 640×360 | 0.92 MB | 28 MB | 111 MB | 276 MB | **553 MB** |
| 480×270 | 0.52 MB | 16 MB | 62 MB | 155 MB | **311 MB** |
| 320×180 | 0.23 MB | 7 MB | 28 MB | 69 MB | **138 MB** |

iOS Safari discards a tab somewhere around 200–400 MB depending on device, and
GPU textures count against it. **600 frames at full resolution is impossible on
a phone** — it is 5 GB.

600 frames is reachable, but only at roughly 320×180 history.

The way out is that **history resolution is not output resolution.** The shader
samples the buffer with hardware bilinear filtering and renders to the full
viewport, so a low-resolution history reads as *soft*, not blocky — and softness
is the entire point of the feature. A 640×360 history at depth 120 costs 111 MB
and will look smoother than today's output, not worse.

**Proposal:** make the trade explicit. Two sliders — history resolution and time
depth — with a live MB readout and a hard budget (~192 MB) that clamps depth
when resolution rises. Never silently allocate 5 GB and get the tab killed.

## 5. Strip mode does not fit this engine

Strip accumulates without bound — that is what makes a 5000px continuous strip
possible. The AA engine has a **fixed-depth** buffer by definition. The two
models are incompatible.

So: **Sweep and Radial get the AA engine; Strip stays on the 2D engine** and the
toggle is unavailable there. Both map beautifully to time-displacement —
Sweep's time offset is the projection onto the slit normal, Radial's is the
angle around the pivot, which gives a rotating window into the past.

## 6. WebGPU is not an option here

The brief says "WebGL / WebGPU preferred". On iOS Safari, WebGPU is not
dependably available; **WebGL2 is** (Safari 15+) and it has what this needs.

One detail worth knowing, because it decides the architecture:

- `TEXTURE_2D_ARRAY` cannot filter *across* layers. Sub-frame temporal blending
  would need two taps plus a `mix()` in the shader.
- `TEXTURE_3D` **can** filter across the depth axis. Setting `LINEAR` gives
  requirement §C.2 — interpolation between frame *N* and *N+1* — **free, in
  hardware**.

So: a 3D texture ring buffer, one `texSubImage3D` per frame. The one catch is
the ring seam, where the newest and oldest frames sit adjacent and hardware
filtering would blend across them; the shader must avoid sampling over it.

Bilinear (§C.1) is free with `LINEAR`. Bicubic is a real shader cost — 9 to 16
taps, multiplied by every exposure-window tap — so it belongs behind a quality
setting, not on by default.

## 7. Memory management is a genuine requirement here, not boilerplate

Acceptance criterion 2 is not a formality: **GPU textures are not garbage
collected.** Dropping a JS reference to a texture leaks it. Changing depth,
resolution, or source must explicitly `gl.deleteTexture()` the old buffer
before allocating the new one.

Two more, both iOS-specific and both easy to miss:

- **Context loss.** iOS drops WebGL contexts aggressively under memory pressure.
  `webglcontextlost` / `webglcontextrestored` must be handled or the app dies
  silently to a black screen.
- **Allocation failure is silent.** An oversized texture can allocate without
  throwing and then read back blank — the same trap already handled for the
  strip canvas. Probe after allocating.

## 8. What the brief needs that v2 no longer has

The control panel asks for an **Input Selector: Webcam / Uploaded Video**. Video
file upload existed in v1 and was dropped from v2 when the dock was stripped
down. It needs restoring — into the settings sheet, not the dock.

The other controls map cleanly: slit orientation already exists (drag, plus the
0/45/90/free chips); time depth, AA toggle and temporal blur window are new.

---

## 9. What shipped

All five decisions resolved as recommended. Built into `v2.html`, off by default,
toggled under **Settings ▸ Anti-aliasing**.

| | |
|---|---|
| API | WebGL2, `TEXTURE_3D` ring buffer, one `texSubImage3D` per frame |
| Spatial AA (§C.1) | hardware bilinear (`LINEAR` on S,T) |
| Sub-frame blending (§C.2) | explicit 2-tap `mix` at exact texel centres |
| Exposure window (§C.3) | 0–8 frames, 1–8 taps, spacing held at ~1 frame |
| Default buffer | 288-short-edge, depth 120 ≈ 82 MB |
| Budget | 192 MB, depth slider clamps itself (600 → 280 at Medium) |
| Cost | **1.0–1.1 ms/frame**, 6% of a 60fps budget, blur-independent |
| Lifecycle | live; shutter is a capture, Export freezes the buffer |
| Strip | forced back to the 2D engine, AA refused |

### Two bugs found by measuring rather than assuming

**Tap spacing.** The first version sized the exposure window as a fraction of
the whole buffer, so at blur 0.25 it took **2 taps across 2 frames** — a double
image, which measured *worse* than no blur at all (13 zigzag reversals against
0). The window is now in frames and the tap count tracks it, holding spacing at
~1 frame so the exposure stays continuous.

**A confounded metric.** Quantifying jaggedness against the built-in demo does
not work: its colour bars are strictly periodic, so temporal averaging beats
against them and manufactures reversals. The numbers were noise. Validation is
therefore visual — same frozen buffer, blur 0 vs 1 — and real-world confirmation
still needs the camera.

### Deferred

- **Bicubic.** Bilinear only, as recommended. Bicubic is 9–16 taps multiplied by
  every exposure tap; it needs its own quality tier and a tap-count cap.
- **`preserveDrawingBuffer: true`** is set so export can read the canvas back.
  It costs some performance; an FBO + `readPixels` path would be faster if that
  ever matters.
- The ring seam is handled by sampling at exact texel centres and mixing
  manually, so hardware never filters across it. That costs the free hardware
  R-axis interpolation noted in §6 — a deliberate trade for correctness.

## 10. Decisions taken

1. **Live vs accumulate (§3).** Confirm the AA engine is live time-displacement
   — the whole image alive and re-rendering — rather than trying to preserve the
   accumulate model. This is the one that changes how the app feels.
2. **Memory budget (§4).** Default history 640×360 at depth 120 = 111 MB, with a
   ~192 MB ceiling and a live MB readout. Or a different budget?
3. **Strip (§5).** Confirm Strip stays on the 2D engine and the AA toggle is
   simply unavailable there.
4. **Bicubic (§6).** Bilinear-only to start, with bicubic behind a quality
   setting? Or bicubic required in v1 of the feature?
5. **Lifecycle (§3).** With a live engine, does Hold become freeze-the-buffer,
   and does Scanning still mean anything distinct from Idle?
