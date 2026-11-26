# CLAUDE.md

Read [AGENTS.md](AGENTS.md): it holds the commands, ground rules, gotchas and definition of done for this repo.

The short version:

- Build with `bun run build` after any change; never edit `dist/`.
- `src/app/*.js` share one scope and are concatenated in a fixed order (see `tools/build.mjs`); no imports.
- Scenes run in the Psychoscript VM (a JavaScript subset) and must pass `bun tools/check-scene.mjs scenes/<file>.js`.
- Look at a screenshot of anything visual you change.
