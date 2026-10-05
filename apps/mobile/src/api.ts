import { createApiClient } from "@klndr/core";

import { getAuthToken } from "@/auth/service";
import { apiBaseUrl } from "@/env";

/**
 * The one API client: the web server's endpoints, with the signed-in user's token attached to every
 * call (none in demo mode). The TanStack Query hooks of task 1.4 sit on top of it.
 */
export const api = createApiClient({ baseUrl: apiBaseUrl, getToken: getAuthToken });
