import { createApiClient } from "@klndr/core";

import { getAuthToken } from "@/auth/firebase";
import { clientId } from "@/data/client-id";
import { apiBaseUrl } from "@/env";

/**
 * The one API client, with the signed-in user's token attached to
 * every request (none in credential-free development). `@klndr/data`'s hooks sit on top of it.
 *
 * `apiBaseUrl` is empty by default, so requests go to this origin — where the dev server proxies `/api`
 * to `apps/api`, and where the API is served in production. CORS is therefore never involved.
 */
export const api = createApiClient({ baseUrl: apiBaseUrl, getToken: getAuthToken, clientId });
