import type { Store } from "@klndr/core";
import type { Session } from "./session";

/** What the middleware puts on the request for the routes: who is calling and their data. */
export type Env = { Variables: { session: Session; store: Store } };
