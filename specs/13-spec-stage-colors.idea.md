# 13 — Colour-coded spec stages in the VS Code explorer  (idea)

**Status: idea, not scheduled.** Dev tooling only. It doesn't touch the piece (`index.html`, `js/`, `shaders/`).

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
In the VS Code explorer, show each spec file's stage (`idea`, `defined`, `ready`, `done`, from its filename suffix)
as a colour: a text background colour, or a small coloured square next to the name.

## What VS Code allows (to verify in a prototype)
- **No row background colours.** Extensions can't set a background colour on explorer rows.
- **Text colour + badge (extension).** The `FileDecorationProvider` API can colour a file's name and add a 1–2
  character badge on the right (a letter such as `D`, or likely an emoji such as 🟩). This is how git status
  colours work. It needs an extension: a small one written for this repo, or an existing marketplace one that
  decorates files by glob, if a suitable one exists.
- **Coloured icon (icon theme).** Icon themes such as Material Icon Theme let settings map a pattern (e.g.
  `*.done.md`) to an icon, including a custom SVG, which would put a coloured square in place of the file icon.
  It needs that theme installed and only works while it's the active icon theme.
- **Emoji in filenames.** Possible, but it makes paths awkward in git and the shell. Probably not.

## Starting questions for the interview
- Which look matters most: a coloured name, a coloured square/icon, or a badge?
- Is installing an extension or an icon theme acceptable, or must it work with plain VS Code settings?
- Should the setup be committed (`.vscode/settings.json`, a recommended-extensions file, a tiny extension in the
  repo), or live in Quin's user settings only?
- Which colour for each stage?
