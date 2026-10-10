import { createApiClient } from "@klndr/core";

import { getAuthToken } from "@/auth/service";
import { clientId } from "@/data/client-id";
import { apiBaseUrl } from "@/env";

/**
 * The one API client: the web server's endpoints, with the signed-in user's token attached to every
 * call (none in demo mode). `@klndr/data`'s TanStack Query hooks sit on top of it. The client id names this
 * phone, so the changes it makes are not announced back to it as if another device had made them.
 */
export const api = createApiClient({ baseUrl: apiBaseUrl, getToken: getAuthToken, clientId });
