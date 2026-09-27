# Foundation decisions

Unit 1, September 26, 2026.

- Build an independent React + TypeScript + Vite app. Use React Flow in the graph phase; do not install graph/layout/export dependencies before they are needed.
- Keep the existing Study Companion planning document separate.
- No AGENTS.md was found at the workspace or checked ancestor directories.
- Node was not available on PATH or in common installation locations. Use a checksum-verified portable Node 22 runtime under `.tools/`; no system installation or permanent PATH changes.
- Browser inventory returned no connected browsers. Live reference inspection and the local visual smoke check remain pending.

## Reference review

[UofT repository](https://github.com/tsids/uoft-course-map), revision `8fba8bd1d0c3847cf6d0985d56f670989cbe22fb`.

The repository manifest uses React 19, React Flow 12, ELK, and Vite. Relevant source areas are `CourseGraph.tsx`, `graphLayout.ts`, and `index.css`. No LICENSE or COPYING file appeared in the complete repository tree. We will not copy its source or assets into the app. Downloaded research files are ignored under `docs/reference/`.

[Vite documentation](https://vite.dev/guide/) supports the React TypeScript template and requires Node 20.19+ or 22.12+. [React Flow documentation](https://reactflow.dev/learn) supports custom React graph nodes. Keep catalog data and plan edits separate as specified in the build plan.

Exact package versions will be pinned by the generated lockfile. No database, hosted backend, credentials, or paid services are needed for this foundation.

The reference source uses custom course/boolean nodes, cached positions, layered downward ELK layout, orthogonal edges, and a grid for isolated nodes. Its repository screenshot shows a dark dotted canvas, compact course cards, AND/OR pills, corner panels, and zoom controls. This screenshot review does not replace testing the live reference.

The portable runtime is Node v22.23.3, downloaded from https://nodejs.org/dist/v22.23.3/ and verified against the official SHASUMS256.txt. npm needed `NODE_USE_SYSTEM_CA=1` to trust the Windows certificate store; TLS verification remains enabled. `scripts/npm.ps1` applies these process-local settings and restores the caller's environment.

Unit 1 follow-up: Chrome reconnected September 26. Live UofT CSC236H1 graph and local welcome page were visually checked; local console had no captured errors. Narrow viewport override did not apply and remains a Unit 4/12 follow-up. Unit 2 sources and schema are documented in catalog-sources.md.
