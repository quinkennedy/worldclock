# 11f — Asia in five pieces  (done)

Part of 11. Changes 11d's region list in `proto/11d-patchwork/`. Requested by Quin on 2026-10-09. Why: Asia was by
far the biggest continent piece (its hull ~19% of the globe; its control triangle had to grow 2.1×), so the most
distorted, and atlases usually split it.

## Decisions
1. **Five pieces** replace Asia (**confirmed**): North Asia, East Asia, Southeast Asia, South Asia, Southwest Asia.
   That makes 11 continents and 7 oceans (18 regions).
2. **Who goes where** (chosen while building, for Quin to confirm):
   - North Asia: Asian Russia (east of the Urals; south edge the Kazakhstan, Mongolia and China borders; Sakhalin
     and the Kurils).
   - East Asia: China (with Hainan and Tibet), Mongolia, the Koreas, Japan, Taiwan.
   - Southeast Asia: Myanmar to Vietnam, Malaysia, Indonesia west of 141°E, the Philippines, Timor.
   - South Asia: India, Pakistan, Afghanistan (as in the UN's grouping), Nepal, Bhutan, Bangladesh, Sri Lanka, the
     Maldives, the Andamans.
   - Southwest Asia: the Middle East, Iran, Anatolia, the Caucasus south of the Europe line, and Central Asia
     (Kazakhstan to Tajikistan).
   The borders are drawn as polygons in `settings.json`, simplified along those borders (the Himalaya, the Amur, the
   Russia-Kazakhstan border, the Myanmar-India border).
3. **Control points** (not published; hand-picked by NGS's rule, then the North and Southeast Asia ones picked from a
   few candidates for the smallest grown triangle in 11e's triangle mode), lon/lat:
   - North Asia: (65°E, 64°N), (180°, 70°N), (120°E, 45°N)
   - East Asia: (85°E, 45°N), (130°E, 48°N), (115°E, 22°N)
   - Southeast Asia: (94°E, 10°N), (125°E, 20°N), (128°E, 8°S)
   - South Asia: (68°E, 33°N), (90°E, 27°N), (78°E, 8°N)
   - Southwest Asia: (40°E, 38°N), (70°E, 48°N), (50°E, 15°N)

## Build notes
- 18 regions don't fit 16 bits, so the region grid is now R32UI (Uint32 per cell).
- Checked in Node: every cell in exactly one region in the three exclusive modes; every shape holds its land in the
  three shape modes. Checked in headless Chrome: the five pieces draw in coastline mode with oceans hidden.
