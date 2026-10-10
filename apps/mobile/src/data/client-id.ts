import * as Crypto from "expo-crypto";

/**
 * Names this run of the app. It goes to the API with every request (see `api.ts`), the API stamps it on the
 * changes it announces, and `live-changes.ts` uses it to tell this phone's own changes from other devices'.
 */
export const clientId: string = Crypto.randomUUID();
