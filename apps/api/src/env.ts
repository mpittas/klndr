import type { Store } from "@klndr/core";
import type { EmojiSuggester } from "./emoji";
import type { Session } from "./session";

/**
 * What the middleware puts on the request for the routes: who is calling, their data, and the emoji picker
 * (`null` when none is configured).
 */
export type Env = { Variables: { session: Session; store: Store; suggestEmoji: EmojiSuggester | null } };
