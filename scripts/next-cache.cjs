/**
 * Stand-in for `next/cache`, used only by scripts/refresh-data.mjs.
 *
 * The app's data layer wraps its fetchers in `unstable_cache(...)` so that one
 * collection of every board is shared by all visitors for an hour. That module
 * only resolves inside a Next runtime, and its whole purpose — serving a cached
 * result instead of going to the network — is the opposite of what a refresh
 * script wants. Passing the function straight through does both jobs at once:
 * `next/cache` resolves outside Next, and every run performs a real fetch.
 *
 * This deliberately implements no caching. Do not "fix" that.
 */
exports.unstable_cache = (fn) => fn;
exports.revalidateTag = () => {};
exports.revalidatePath = () => {};
