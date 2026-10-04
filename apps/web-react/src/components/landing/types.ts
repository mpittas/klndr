/**
 * Where the landing page's calls to action point.
 *
 * The landing page works out one of two destinations and passes the same object down to every section.
 * It is a union of the two literal routes rather than `string` so TanStack Router's `<Link to>` accepts it
 * without a cast.
 */
export type LandingStart = { to: "/calendar" | "/signup"; label: string };
