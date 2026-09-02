/**
 * How long fetched third-party data is served before we go out and get it
 * again — the one number the pages and every fetcher share.
 *
 * Six hours, not one. This cuts our outbound calls to eight third-party
 * sites from 24/day each to 4/day, and four of those eight are scraped out
 * of pages built for humans rather than fetched from an endpoint their
 * operator offers us — so the polite ceiling on how often we ask is a good
 * deal lower than the polite ceiling on an API. Nothing is lost by waiting:
 * of the eight boards, one updates hourly, several are continuous (so any
 * sampling interval is arbitrary), and two have not changed in months.
 * Hourly was buying us a fresher timestamp, not fresher numbers.
 *
 * The pages carry this as a literal `export const revalidate`, because Next
 * requires that value to be statically analyzable; the comment there points
 * back here so the two cannot drift unnoticed.
 */
export const DATA_TTL_SECONDS = 21600;
