# S-Box Evaluation Toolkit

A browser-based toolkit for constructing, analysing and visualising cryptographic
S-boxes, and for judging which classes of attack an S-box is weak against.

> M.Tech CSE semester project — Department of Computer Science and Engineering,
> Indian Institute of Information Technology, Pune.
> Author: B P Pranavan Paramesh (MIS 222515010) · Guide: Dr. Mahesh Joshi.

## Features

- **Attack verdict** — strong / caution / weak per attack family (differential, linear,
  boomerang, differential-linear, algebraic, structural, avalanche), graded against the
  best known values and 10,000 random permutations of the same size.
- **Interactive tables** — DDT, LAT, BCT and DLCT as heatmaps; hover to read, click (or use
  the arrow keys) to select a cell.
- **Inspector** — explains the selected cell in detail: coordinates, probability / bias /
  correlation, the concrete input pairs behind a DDT entry, what it gives an attacker, how it
  compares with its row, column and table, plus jumps to the strongest cells.
- **Load S-boxes** — reference S-boxes (AES, PRESENT, GIFT, SKINNY, Serpent, PRINCE, Midori,
  DES), random 8- or 4-bit permutations, or paste your own (hex, decimal, C arrays).
- **Affine equivalence** — tests the S-box against every reference S-box of the same size
  (Biryukov et al. 2003 algorithm) and shows the affine maps when it is a known S-box in
  disguise; 4-bit optimal S-boxes are placed in their Leander–Poschmann class G0–G15.
- **S-box table** — the lookup table itself, with fixed points marked.
- **Advanced** (in the source panel, collapsed by default) — simulated-annealing search for
  strong S-boxes, running in a Web Worker with live progress.

Everything runs in the browser; there is no server.

## Offline single-file version

`npm run build:single` writes `dist-single/index.html` (~320 KB): the complete app — code,
styles, data and both Web Workers — in one file. Copy it anywhere and open it by
double-clicking; it needs no internet connection, server or installation.

## Status

Work in progress.

## Getting started

Requirements: [Node.js](https://nodejs.org/) 20.19+ (22 LTS recommended, see `.nvmrc`).

```sh
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
npm test           # run the unit tests
npm run typecheck  # type-check JSDoc annotations
npm run build      # production build into dist/
npm run build:single # whole app in one offline file: dist-single/index.html
npm run precompute # regenerate src/data/*.json (presets + random baseline, ~1.5 min)
```

> **WSL users:** keep the project inside the Linux filesystem (e.g. `~/projects`),
> not under `/mnt/c`, for fast installs and reliable file watching.

## Tech stack

- React 19 + Vite — UI and build
- Plain JavaScript with JSDoc types, checked by the TypeScript compiler
- Vitest — unit tests
- Plain `<canvas>` heatmaps and SVG charts — no charting library

## Project layout

```
src/core/       analysis engine (pure JS, unit-tested): DDT, LAT, BCT, DLCT, ANF,
                SAC/BIC, generators, search, verdict rules
src/data/       precomputed preset metrics and random-permutation baseline
src/components/ React UI
src/workers/    Web Worker running the heuristic search
scripts/        build-time precomputation
```

## License

[MIT](LICENSE)
