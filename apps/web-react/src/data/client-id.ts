/**
 * Names this open tab. It goes to the API with every request (see `api.ts`), the API stamps it on the
 * changes it announces, and `live-changes.ts` uses it to tell its own changes from other devices'.
 */
export const clientId: string = crypto.randomUUID();
