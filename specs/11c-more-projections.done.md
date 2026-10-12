# 11c — More projections in the orange-peel prototype  (done)

Part of 11. Adds projections to the 11a prototype at `proto/11-orange-peel/` so they can be compared on the real
display. Requested by Quin on 2026-10-09: HEALPix, Nicolosi globular, Lambert azimuthal equal-area, Peirce
quincuncial, Guyou, Cahill butterfly, Cahill-Keyes, Dymaxion, Hao.

## Decisions (confirmed by Quin, 2026-10-09)
1. **Gore-ify where possible.** A projection that can be cut into gores becomes a gore projection beside 11a's,
   with count, gap, join, spill and anchoring. The rest are whole-world maps: no gores, no spill; the gore controls
   are hidden for them, and anchoring turns the map about the poles (land: a turn slider; sun: the sub-solar
   meridian on the map's central meridian, plus an offset slider).
   - **HEALPix** is a gore projection: each gore is one lobe (cylindrical equatorial band within |sin lat| ≤ 2/3,
     a triangle towards each pole, π/4 tall for any count, so it stays equal-area). Neighbouring gores touch along
     the whole band by construction.
   - **Nicolosi globular** is 11a's `globular` gores; with count 2 it's the classic two-hemisphere Nicolosi.
   - **Lambert azimuthal equal-area, Peirce quincuncial, Guyou, Cahill butterfly, Cahill-Keyes, Dymaxion, Hao**
     are whole-world maps.
2. **Library:** d3-geo 3.1.1, d3-geo-projection 4.0.0 and d3-geo-polygon 2.0.1, pinned, from jsDelivr (`+esm`).
   Prototype only; 11b decides what the piece would use.
3. **Hao:** no published formula found (the projection was presented at ICA 2001 as the "Generalized
   Equivalent-Difference Latitude Parallel Polyconic Projection"). Approximated as the planisphere R package
   does: d3 `geoHufnagel` with a 0.8, b 0.35, psiMax 50, ratio 1.6, rotate [110, −200, 90], angle 90.
   Labelled "Hao (approximation)" in the panel.
4. **Lambert:** the whole world in one disc, centred on the equator (on 0° for land anchoring, on the sub-solar
   meridian for sun anchoring).

## Build notes
- `maps.js`: each whole-world map is a mesh of 1° lon/lat cells (the Render folder's mesh step), projected forward
  on the CPU in float64 with d3, so no inverse is needed (Cahill-Keyes's d3 inverse throws). Vertices carry the
  point on the sphere; `shaders/map.frag` normalises it and looks the scene up there, plus the anchoring's
  longitude offset. Cells mustn't straddle a cut:
  - Lambert, Peirce, Guyou, Hao: the grid has a line on every cut meridian (in Lambert's case on a grid whose pole is
    the map's centre, so the antipode, which is the whole rim, is the grid's other pole; Hao's grid is in its
    oblique frame). Each cell projects its own corners and, where a corner lies on a cut, a copy nudged towards
    the cell's centre, so it lands on its own side. Corners off the cuts keep their exact position, so cells
    meet exactly. Peirce and Guyou get extra grid lines at halving distances towards their fold points (equator
    and ±45°), where the map isn't smooth.
  - Butterfly, Cahill-Keyes, Dymaxion: cells whose projected edge midpoints don't lie between their corners are
    clipped to the faces with d3's own spherical clip (the projection's preclip), ear-clipped (a face corner can
    poke into a cell), and each triangle picks its side of the cuts by its own centre.
  - Checked in Node: each mesh's area matches d3's own outline area to 0.2%, with no stray triangles (largest
    edge under 2.5% of the map's width, at Peirce's fold points). Every map is right-handed (not mirrored).
  - Build time (Node, 1° mesh): 0.1 to 0.9 s, Dymaxion 2.4 s (it runs once, when the projection is chosen).
- The scene texture for whole maps is about 1.5 × the map's width in px (decision 16 of 11a, roughly).
- Checked in headless Chrome (SwiftShader, 1600×900) at the March equinox, land anchoring: every map draws with no
  console errors, and the terminator is where it should be (Lambert: the lit hemisphere is the central disc; Peirce:
  a straight line through the pole at the centre).
- Dymaxion comes out of d3 in its usual net orientation, which isn't north-up (Africa reads upside down). The turn
  slider only turns the Earth about its poles, not the net.

## Not done
- Spill past the cuts of the whole-world maps (decision 1).
- The real Hao projection (decision 3).
