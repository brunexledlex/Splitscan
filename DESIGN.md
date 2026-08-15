# Design notes

Why the app looks and behaves the way it does. This is the part of the project
I actually cared about.

Design and direction by [Bruno Silva](https://ditongo.com) / [Ditongo](https://ditongo.com).

---

## v2 — SLIIIT

The app was rebuilt against a Figma spec partway through, and the identity
changed with it: bituminous-black ground, a single mint accent (`#CEFDD3`),
Inter at 12/15, pill geometry throughout. The full rationale for each feature
is written up as it was built, before the code — read these in order for the
actual design process:

1. [docs/v2-spec.md](docs/v2-spec.md) — the immersive capture UI: full-bleed
   viewport, the ghosted-bezel instrument, moving commands off a bottom bar
   and onto the image itself.
2. [docs/slit-shapes-spec.md](docs/slit-shapes-spec.md) — Burst and Field, and
   the realisation that every slit is one scalar time-field with a different
   distance function, which is what let two very different-looking effects
   share a single engine.
3. [docs/aa-engine-spec.md](docs/aa-engine-spec.md) — the WebGL anti-aliasing
   engine: why it needs a second renderer entirely, and the memory budget that
   makes "600 frames of history" a real constraint on a phone rather than a
   slider label.

A few decisions worth pulling out here rather than leaving buried in those specs:

**The lime line is the slit, not a decoration around it.** Early builds drew a
static mint rule down the screen edge as a brand mark; it now marks exactly
where the scan is reading, in every state, because a camera's one indispensable
piece of chrome is knowing where the exposure is happening.

**Capture doesn't ask.** The old flow was tap shutter → dialog → pick a format
→ tap again. It's now tap once, the pass runs itself, the frame archives
itself under a unique name, and the feed returns — because a four-to-ten-second
exposure is already a commitment; asking again afterwards just makes you wait
twice.

**The roll exists because Safari won't let anything else.** `navigator.share`
and downloads both require live user activation, and a pass is well past that
window by the time it finishes. No web app can silently write to the photo
library — that's an iOS rule, not a gap in this one — so the roll is the
next-best thing: one gesture, at the end of a session, covers everything shot
during it.

**Capture resolution follows the device.** The Figma brief specified a fixed
1920×1080 export; on a portrait phone that cropped roughly three-quarters of
the picture away. There was no reason for the fixed size once it was checked
against an actual device aspect, so capture now matches the screen.

---

## v1 — the original prototype

What follows describes `index.html`, the darkroom-instrument identity the
project started with, kept here as the historical record rather than rewritten
to match the rebrand.

## The brief I set myself

A slit-scan app is usually presented as a filter: sliders, a preview, an Apply
button. That framing is wrong for what is happening. A rotating slit is not an
effect applied to a picture — it is an **instrument** operating on a live image,
closer to a radar PPI display or a photo-finish camera than to a filter panel.

So the design question was never "what should the controls look like." It was
**what instrument is this, and what would its housing look like.**

## Direction: darkroom instrument

The subject's own world supplies the palette. Darkrooms are lit amber because
photographic paper is insensitive to that end of the spectrum — a safelight is
the one light you are allowed while the image is still forming. That is a
precise metaphor for an app where the image forms slowly, in front of you, over
seconds.

So: amber means *live*. Nothing else is amber. The blade, the driven slider, the
active mode, the readout that is currently moving.

### Colour

| Token | Value | Role |
|---|---|---|
| `--ground` | `#0D0A08` | Bituminous near-black with a warm bias. Not `#000`, not a neutral grey — darkroom black has brown in it. |
| `--panel` | `#17120E` | The instrument body. Anodized, not plastic. |
| `--raised` | `#211A15` | Raised controls. |
| `--line` | `#33281F` | Hairlines, warm enough to read as machined rather than drawn. |
| `--ink` | `#EDE4D8` | Fibre-based print white. Paper, not screen white. |
| `--dim` | `#9C8E7E` | Inactive labels. |
| `--amber` | `#FF9A2E` | Safelight. **Live state only.** |
| `--rec` | `#FF3B30` | Reserved for Hold. Never decorative. |

The neutrals are all biased toward the accent. A pure mid-grey next to amber
reads as unconsidered; these read as chosen.

### One theme, on purpose

This is the only page I would defend shipping without a light mode. A viewfinder
that turns white destroys your dark adaptation and your ability to judge the
image you are making — the same reason darkrooms and cockpits and telescope huts
are dark. It is a deliberate commitment, so every colour is painted explicitly
and nothing is inherited from the host.

### Type

The platform's own faces, which on an iPhone means SF Pro and SF Mono. Not a
fallback — a choice. A camera app should open instantly, and loading a webfont to
render eleven words of chrome is a bad trade. SF Mono is also a genuinely good
instrument face.

Every number is monospace with `tabular-nums`. An angle readout that jitters as
digits change width is unusable on a rotating blade — the digits must sit still
while the values move.

## Layout: the viewfinder is the product

Edge to edge, everything else floating over it. A thin rail above with live
readouts, a control deck below.

The deck has a compact tier under `700px` of viewport height, because on an
iPhone SE the full deck was **taller than the viewfinder** — 323px of controls
against 295px of image. For a camera that is simply the wrong ratio, whatever it
measures at on a larger phone. The compact tier put it back to 269 against 349;
losing the speed slider has shortened it further since.

Collapsing the deck is real, and was not at first: `.collapsible` carried an
inline `display:flex` that silently beat the `display:none` rule, so the grab
handle did nothing for a while. Fixed, collapsing drops the deck to ~131px and
leaves the angle and the mode row.

## The one bold thing

**A tick-marked bezel drawn around the rotation centre**, and you grab the image
to spin it.

Every other decision in the app is quiet so this one can be loud. It is a lens
focus ring for time: the bezel is drawn on the canvas rather than in the chrome,
so the instrument visibly acts *on the image* instead of beside it. Ticks every
15°, labelled every 90°, the live blade in amber, a crosshair on the pivot.

Dragging the picture to spin the blade is the interaction the whole app is built
around. You are not setting a parameter, you are **painting with time** — fast
where you flick, slow where you linger, and the smear records the gesture. The
slider exists as the precise secondary control, not the primary one.

Touching the image switches to Manual automatically, because reaching for a mode
toggle first would break the thought.

## Smaller decisions that mattered

**The reticle lives on its own canvas.** Guides that bake into your saved
picture would make the whole overlay a liability. Two stacked canvases, and only
the lower one is ever exported. Verified: with accumulation frozen, the export
canvas holds zero non-ground pixels while the overlay holds ~8,000.

**Driven sliders stay live instead of greying out.** In Auto, the slider the
machine is driving is disabled but keeps moving, and turns amber. A dead grey
control tells you nothing; a moving one shows you the machine working.

**Labels change with the geometry.** The width control is not one quantity — it
is `Slit` in px for Sweep, `Blade` in degrees for Radial, `Rate` in px per frame
for Strip. Naming them all "width" would be a lie about what the number does.

**Rate has no control at all.** There was a speed slider; it is gone. Each
geometry now runs at a fixed rate in its own units — 200 px/s for Sweep, 40°/s
for Radial, 20°/s for Strip. One shared number was never possible, because they
are not the same quantity: a value that suits a spin makes a sweep crawl. Given
the choice between three sliders for one idea and three good constants, the
constants won, and Manual mode is where speed actually wants to be expressed
anyway — with your thumb.

**Angle sits directly under the image**, above even the mode selector, and it is
the only control outside the collapsible deck. Collapse everything else and you
still have the slit angle: the smallest useful version of this instrument is a
picture and an angle.

**A demo source that runs before permissions.** The app does something the
instant it opens, without asking for the camera first. Asking for a permission
before showing anything is a bad trade for the person on the other side, and a
synthetic source of high-contrast moving edges shows slit-scan artefacts more
legibly than most real scenes anyway.

**The icon is generated, not drawn** — the radar sweep rendered by
`tools/make-icons.mjs`, quantised into discrete slices, because smooth gradient
wedges made it read as a pie chart rather than as sliced time.

## What I would change

- The letterboxing is honest but ugly: a 16:9 source in a portrait viewport
  leaves big dead bands. A fill/fit toggle, or cropping the source to the
  screen's aspect, would use the glass better.
- No way to record a scan as video. The gesture in Manual mode is performative —
  the fact that only its residue survives is a real loss.
- The pivot crosshair is the only draggable thing that isn't discoverable. It
  needs an affordance, or a first-run hint.
- Blade width in Radial is angular, so slices are thin at the pivot and wide at
  the rim. A constant-arc-length option would give more even texture.
