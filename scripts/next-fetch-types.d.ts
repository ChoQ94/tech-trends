/**
 * Next augments the global `RequestInit` with its `next: { revalidate, tags }`
 * option. Inside the app that augmentation arrives via the generated
 * `next-env.d.ts`, which is gitignored and does not exist in a fresh clone
 * until something runs `next build`.
 *
 * scripts/tsconfig.refresh.json compiles the fetchers on their own, ahead of
 * any Next build, so it references Next's declarations directly instead. This
 * keeps `npm run refresh-data` working on a clean checkout.
 */
/*
 * A triple-slash reference is the only thing that works here: `import` would
 * make this a module, and a module's declarations do not merge into the global
 * scope, which is the entire point of the file.
 */
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../node_modules/next/types/global.d.ts" />
