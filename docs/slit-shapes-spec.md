# Slit shapes — understanding & impact

New geometry: a **circular slit** replacing Radial, and a **split-slit**
replacing Split. Nothing implemented. Decisions at the bottom.

---

## 1. The thing that makes both of these cheap

Every slit the app has ever drawn is the same algorithm with a different
**distance function**. Time is a scalar field `t(x, y)` over the frame, and the
slit is simply the contour where `t` is *now*:

| Shape | `t(x, y)` | The slit is |
|---|---|---|
| Linear (Swipe) | distance along a normal, `dot(p, n)` | a straight line |
| **Circular** | distance from a centre, `length(p - c)` | a **ring** |
| **Split-slit** | distance from a band, `abs(dot(p, n)) - w` | **two parallel lines** |
| Old Radial | angle about a pivot, `atan2` | a rotating blade |

So this is not two new engines. It is one refactor — express the geometry as a
time field — after which each shape is about five lines in each engine:

- **2D path**: the clip changes. A ring is an arc path with two radii; a
  split-slit is two bands. Both are still `clip()` + `drawImage()`.
- **WebGL path**: one line in the fragment shader. The AA engine already
  computes `t` and samples the history buffer at that depth; it does not care
  where `t` came from.

Doing the refactor first is what stops this becoming three parallel
implementations that drift apart.

## 2. Circular slit — "sunburst"

A ring centred on the pivot, its **radius** sweeping outward (or inward). Each
concentric ring of the picture is frozen at the moment the slit passed through
it. Exactly the linear behaviour with radius substituted for distance-along-an-
axis.

Why it reads as a sunburst: anything moving gets smeared **along radial lines**,
because neighbouring radii are neighbouring moments. Rays diverging from the
centre are the natural artefact of mapping time to radius — the effect is the
geometry, not a filter on top of it.

- Centre is the existing pivot, still movable.
- `Rate` becomes ring thickness, unchanged in meaning.
- Direction: outward (centre → rim) or inward. Outward is the default.
- The lime reference line becomes a **4px circle**.

With anti-aliasing on it is one line — `t = length(p) / maxR` — and it should
look considerably better than the old blade, because a ring has no pivot
singularity where all the wedges converge and alias.

## 3. Split-slit — "force field"

The frame splits into three zones about an orientable band:

```
    ◀── slit travels this way
 ────────────────────────────────
                                     ← time smears outward
 ════════════ handle A ═══════════
 ▓▓▓▓▓ CENTRAL BAND — LIVE ▓▓▓▓▓▓     ← untouched, real time
 ════════════ handle B ═══════════
                                     ← time smears outward
 ────────────────────────────────
    slit travels this way ──▶
```

- The **central band is unaltered** — I am reading that as *live real-time
  video*, not "frozen". The force-field metaphor says time inside the field is
  normal; everything outside is displaced.
- **Two slits, opposing directions**, mirrored about the band, so the picture
  distorts symmetrically outward from a calm centre.
- The band is **orientable** and **variable width**, set by **two handles** —
  one per edge.

### The two handles

Model each handle as a point at `centre ± n·w`, where `n` is the band normal:

- dragging a handle **across** the band changes `w` — the width
- dragging it **around** changes `n` — the orientation
- so two handles give both controls with no extra chrome, which is what the
  brief asks for

The lime reference becomes **two parallel lines** — the band edges — with the
handles drawn on them.

## 4. What this breaks

### 4.1 Panorama loses its source

This is the one that matters. The old Split is the *unbounded stacking scan* —
it grows without limit, and it is the only reason the 5000px continuous
**Panorama** export exists. Split-slit is a fixed-frame effect. Replace Split
and Panorama has nothing to export, so the export card drops to one option.

Three ways out, and this needs a decision:

- **Keep the stacking scan as a fourth mode.** The bar currently holds three
  pills at 440px wide; a fourth fits only by shortening labels.
- **Drop Panorama.** Simplest, and the export card becomes a single button.
- **Give Split-slit a stacking variant later.** Defers the problem.

### 4.2 The rotating blade disappears

The blade is the thing this project was built around — the original brief was
"angled, and *rotating*", and both README and DESIGN.md are written about it.
Replacing Radial retires it.

That may well be right: the circular slit is a better idea, and it has no pivot
singularity. But it is a real change of identity, and the docs would need
rewriting rather than patching. Worth saying out loud before I do it.

### 4.3 Blades (1–4) becomes meaningless

N-fold symmetry only exists for a rotating blade. A ring has no equivalent.
The control should go, unless it becomes "number of concentric rings", which is
a different feature.

### 4.4 The swipe gesture has no cardinal directions on a circle

The swipe just built maps four cardinal directions to a slit side. A ring has no
sides. Proposal:

| Mode | swipe | result |
|---|---|---|
| Swipe | up / down / left / right | slit side, as now |
| **Circular** | up | expand — centre → rim |
| | down | contract — rim → centre |
| **Split-slit** | up / down | nudge band width |
| | left / right | rotate band 90° |

Split-slit's handles already do width and orientation directly, so the swipe
there is a coarse shortcut, not the primary control.

### 4.5 Handles versus swipe — the conflict that already bit once

Canvas pivot dragging was removed one commit ago precisely because the pivot sat
at screen centre, where every swipe starts, and silently swallowed them. Handles
risk the same failure: at zero band width both handles stack on the centre.

Mitigation: enforce a **minimum band width** so the handles never meet, and let
a drag that *starts on a handle* always be a handle drag — unambiguous, because
dragging is how you move a handle anyway.

## 5. Naming

Three pills at 12px. Their own metaphors are the best labels:

| Now | Proposed | From |
|---|---|---|
| Swipe | **Swipe** | unchanged |
| Radial | **Burst** | "a bit like a sunburst" |
| Split | **Field** | "a bit like a force field" |

## 6. Decisions needed

1. **Panorama** — keep the stacking scan as a fourth mode, or drop the
   Panorama export with it? (§4.1)
2. **The rotating blade** — retire it, or keep it as a fourth mode alongside
   the circular slit? (§4.2)
3. **Central band** — live real-time, as I have read it? (§3)
4. **Two slits** — both travelling outward from the band, or both inward? I
   assume outward.
5. **Blades control** — remove, or repurpose as concentric ring count? (§4.3)
6. **Names** — Swipe / Burst / Field, or something else? (§5)
