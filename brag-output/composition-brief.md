# Hyperframes Composition Brief: UNTOLD

## Objective
Create a premium 20-second cinematic launch video for UNTOLD, showing its actual story discovery, scheduled reveal, predictions, and theory discussion experience.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/untold-dark.mp4`
- Poster frame: `brag-output/untold-dark.jpg` (frame 0 is baked to this image)
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:/projects/UNTOLD/untoldupdatev2-backup`
- Primary files read: `README.md`, `package.json`, `app/page.tsx`, `app/write/page.tsx`, `components/PredictionCard.tsx`, `app/globals.css`, `app/dark-theme.css`
- Product name: UNTOLD
- Tagline / strongest claim: “Every story has a missing piece.”
- Key UI or visual moment to recreate: Discover feed card → hidden/scheduled chapter → reader prediction and theory room.
- Copy that must appear verbatim:
  - “Every story has a missing piece.”
  - “Read a little. Guess a lot. Discover the truth.”
  - “Pick what happens next.”
  - “THE NEXT PART” / “REVEAL PENDING”

## Creative Direction
- Tone preset: cinematic
- Creative direction: quiet, premium mystery trailer for an editorial storytelling product
- Interpretation: dramatic reveals, steady camera movement, soft crossfades, restrained accents, and readable holds.
- Angle: Treat the missing piece like a cinematic mystery: discover a real story card, see that its next part is scheduled and hidden, then watch readers predict and discuss what may happen.
- Hook: “Every story has a missing piece.” over the specified deep charcoal and near-black palette.
- Outro: “Read a little. Guess a lot. Discover the truth.” resolves into UNTOLD and the exact brand line.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Claims that the reader app blurs content; the source blur/lock overlay is in Creator Studio preview
  - Real user data

## Visual Identity
- Background: #0B0D12 / #12151C
- Panels: #191D27
- Text: #F5F5F7; secondary #A1A7B5
- Accent: #A78BFA violet, with sparing electric blue
- Display font: Playfair Display (bundled)
- Body font: project DM Sans approximated by HyperFrames’ bundled Inter for reliable local rendering
- Visual references from the project: top navigation/Discover tabs, story card, scheduled reveal chip, lock overlay, prediction card, Theory Room. Preserve UI layout and copy; this is a video treatment of the app, not a live-app screenshot recolored as a claim that a dark theme already ships.

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The missing piece — 3s — brand hook and Discover surface.
2. Find the story — 4s — actual feed tabs, fictional story card and scheduled reveal chip.
3. The part stays hidden — 4s — Creator Studio locked preview and reader countdown.
4. Guess together — 5s — prediction selection and Theory Room discussion.
5. UNTOLD — 4s — brand close and exact tagline.

## Audio
- Audio role: cinematic support
- Audio arc: quiet swell through the reveal and participation, restrained logo hit, clean fade.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: 0.30 volume, start at 0, gentle build and fade at end.
- Music cue guidance: `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; 109.96 BPM. Potential reveal cues 8.74s and 17.47s, while preserving readable holds.
- Audio-reactive treatment: subtle; reader card warmth/edge glow only.
- Audio-coupled moments:
  - Feed card arrival — soft card accent.
  - Hidden chapter overlay — low soft reveal.
  - Prediction selection — restrained UI click.
  - Closing wordmark — final soft impact.
- SFX selection guidance: sparse cinematic motion matches; use only local bundled SFX and keep them under music.
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md` if available.
- Exact SFX choice: choose after animation exists; 2–3 cues maximum.
- Audio files: copy chosen music into `composition/assets/music/`; local sound effects in `composition/assets/sfx/`.

## Hyperframes Instructions
Use the installed Hyperframes workflow and current CLI contract. This brief and the Brag plan define product angle, claims, visual references, pacing, audio, and delivery. Build the composition in `brag-output/composition/`, show actual project UI patterns, preserve readable text, keep the runtime 15–25 seconds, run `npx hyperframes check`, and render locally to `brag-output/untold-dark.mp4`. Keep the poster at `brag-output/untold-dark.jpg`. No publishing or remote workflows.

Any sample story title, theory, author, and prediction options are fictional illustrative content for the composition, not actual user content or product claims.
