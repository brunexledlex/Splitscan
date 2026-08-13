# Design notes

Why the app looks and behaves the way it does. This is the part of the project
I actually cared about.

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
measures at on a larger phone. The compact tier puts it back to 269 against 349.

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

**Labels change with the geometry.** `Speed` is not a universal quantity here —
it is `Travel` in px/s for Sweep and `Spin` in °/s for Radial. Naming them the
same thing would be a lie about what the number does. Same for `Slit` / `Blade` /
`Rate`.

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
