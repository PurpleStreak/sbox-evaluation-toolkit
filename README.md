# S-Box Evaluation Toolkit

A browser-based toolkit for constructing, analysing and visualising cryptographic
S-boxes, and for judging which classes of attack an S-box is weak against.

> M.Tech CSE semester project — Department of Computer Science and Engineering,
> Indian Institute of Information Technology, Pune.
> Author: B P Pranavan Paramesh (MIS 222515010) · Guide: Dr. Mahesh Joshi.

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
```

> **WSL users:** keep the project inside the Linux filesystem (e.g. `~/projects`),
> not under `/mnt/c`, for fast installs and reliable file watching.

## Tech stack

- React 19 + Vite — UI and build
- Plain JavaScript with JSDoc types, checked by the TypeScript compiler
- Vitest — unit tests

## License

[MIT](LICENSE)
