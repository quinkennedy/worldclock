# 03b — Land-cover palette in the piece  (done)

Part of 03 (land-cover CMYK halftone). Brings 03a's "Faded amber (subtle)" palette into the public page as flat day
colours. Every decision below was confirmed by Quin.

## Outcome
On the day side the land is faintly coloured by land cover (arid, forest, grass, ice) on an amber-ivory paper tone,
with the water a slightly darker grey-green. Night and moonlight are unchanged.

## Scope
In: four land-class day colours, the class mix, the new day water colour, config and GUI.
Out: halftone and dots (03), the elevation curve and dominant-class mode (03a only), per-class moon or night
colours.

## Decisions
1. **Palette:** 03a's "Faded amber (subtle)": water `#c4c2a7`, arid `#dacda7`, forest `#cec59f`, grass `#d4c9a2`,
   ice `#dfd6b7`. Its elevation curve is off (zero amounts) and isn't ported.
2. **Water:** `palette.dayWater` becomes `#c4c2a7`. The reaction-diffusion glints stay on top of it as before.
3. **Day stop only:** the class colours replace the single day land colour. `moonLand` and `nightLand` stay single
   colours, so the moonlit and night sides are unchanged.
4. **Mix:** land classes mix by their share of the cell's land in OKLab (as 03a's fraction mix), from
   `data/land.png` and `data/landcover.webp`. The coastline stays the piece's (land fraction smoothstepped 0.4–0.6).
   The mixed colour then goes through the night → moon → day blend in sRGB as before.
5. **No elevation curve, no dominant-class mode** in the piece.
6. **Config:** `palette.dayLand` is removed; `palette` gains `dayArid`, `dayForest`, `dayGrass`, `dayIce`. Each is a
   colour picker in the dev GUI's Twilight folder. The 11a/11d prototypes, which draw the piece's scene, follow.

## Acceptance
- The public page at the March equinox (`?gui&t=2026-03-20T12:00Z`) shows faint class tones on the day side: Sahara
  arid, Amazon and Congo forest, Greenland and Antarctica ice; the night and moonlit sides look as before.
- The GUI's four class pickers change the day land live; Copy config includes them and no `dayLand`.
- 11a and 11d still draw the scene, with the class colours.
- The long-run test in `DEV.md`.

## Build notes
- `shaders/sun.frag` mixes the classes (`dayLand()`, with an OKLab → sRGB conversion copied from 03a); the four
  colours are converted to OKLab on the CPU (`hexToOklab` in `js/config.js`). `landcover.webp` loads through
  `createCoverTexture` in `js/gl.js` (about 1.5 MB more on page load).
- 11a/11d (`proto/11-orange-peel/scene.js`) bind the same texture and uniforms. Their `settings.json` still
  overrides `dayWater` with their own teal.
- Checked in headless Chrome (SwiftShader) at the March equinox: the public page with `?gui`, 11a and 11d, with no
  console errors. Long-run test still to do.
