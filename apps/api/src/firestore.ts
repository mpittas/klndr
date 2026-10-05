/**
 * Minimal Firestore REST client that acts *as the signed-in user*.
 *
 * Every request carries the caller's Firebase ID token, so `firestore.rules`
 * is enforced on the server exactly as it is in the browser. The server holds
 * no admin credentials, so a server bug can't read or write another user's data.
 */

/** REST endpoint; `FIRESTORE_EMULATOR_HOST` (e.g. `127.0.0.1:8080`) points it at the local emulator for tests. */
const emulatorHost = typeof process !== "undefined" ? process.env?.FIRESTORE_EMULATOR_HOST : undefined;
const API = emulatorHost ? `http://${emulatorHost}/v1` : "https://firestore.googleapis.com/v1";

type FsValue = Record<string, unknown>;
export type FsDoc = { id: string; data: Record<string, unknown> };

export class FirestoreError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Firestore ${status} ${code}`);
  }
  get notFound() {
    return this.status === 404 || this.code === "NOT_FOUND";
  }
  get alreadyExists() {
    return this.status === 409 || this.code === "ALREADY_EXISTS" || this.code === "ABORTED";
  }
}

function encode(value: unknown): FsValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
  }
  throw new Error("Unsupported Firestore value");
}

function decode(value: FsValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("doubleValue" in value) return value.doubleValue;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: FsValue[] }).values ?? [];
    return values.map(decode);
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, FsValue> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
  }
  return null;
}

type RawDoc = { name: string; fields?: Record<string, FsValue> };

function decodeDoc(raw: RawDoc): FsDoc {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw.fields ?? {})) data[key] = decode(value);
  return { id: raw.name.slice(raw.name.lastIndexOf("/") + 1), data };
}

export type Write =
  | { op: "create"; path: string; data: Record<string, unknown>; serverTimes?: string[] }
  | { op: "update"; path: string; data: Record<string, unknown>; serverTimes?: string[] }
  /** Writes the given fields, creating the document when it is not there yet. */
  | { op: "upsert"; path: string; data: Record<string, unknown>; serverTimes?: string[] }
  /** `mustExist: false` deletes unconditionally, which is what emptying a collection needs. */
  | { op: "delete"; path: string; mustExist?: boolean };

export type Filter = { field: string; op: "EQUAL" | "GREATER_THAN_OR_EQUAL" | "LESS_THAN_OR_EQUAL"; value: string };

export class Firestore {
  private readonly root: string;

  constructor(
    private readonly projectId: string,
    private readonly idToken: string,
  ) {
    this.root = `projects/${projectId}/databases/(default)/documents`;
  }

  private async call(url: string, body?: unknown): Promise<any> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${this.idToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new FirestoreError(503, "UNAVAILABLE");
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (Array.isArray(json) ? json[0]?.error : json?.error) ?? {};
      throw new FirestoreError(response.status, String(error.status ?? "UNKNOWN"));
    }
    return json;
  }

  async get(path: string): Promise<FsDoc | null> {
    try {
      return decodeDoc(await this.call(`${API}/${this.root}/${path}`));
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return null;
      throw err;
    }
  }

  /** Query a collection under `parentPath` (e.g. `users/{uid}`); all filters are ANDed. */
  async query(parentPath: string, collectionId: string, filters: Filter[] = [], limit = 1000): Promise<FsDoc[]> {
    const fieldFilters = filters.map((f) => ({
      fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: encode(f.value) },
    }));
    const where =
      fieldFilters.length === 0
        ? undefined
        : fieldFilters.length === 1
          ? fieldFilters[0]
          : { compositeFilter: { op: "AND", filters: fieldFilters } };

    const rows: Array<{ document?: RawDoc }> = await this.call(
      `${API}/${this.root}/${parentPath}:runQuery`,
      { structuredQuery: { from: [{ collectionId }], where, limit } },
    );
    return rows.flatMap((row) => (row.document ? [decodeDoc(row.document)] : []));
  }

  /** Apply writes atomically. Create/update/delete each carry an existence precondition; upsert has none. */
  async commit(writes: Write[]): Promise<void> {
    const body = {
      writes: writes.map((write) => {
        const name = `${this.root}/${write.path}`;
        if (write.op === "delete") {
          return {
            delete: name,
            ...(write.mustExist === false ? {} : { currentDocument: { exists: true } }),
          };
        }
        const fields = Object.fromEntries(Object.entries(write.data).map(([k, v]) => [k, encode(v)]));
        return {
          update: { name, fields },
          ...(write.op !== "create" ? { updateMask: { fieldPaths: Object.keys(write.data) } } : {}),
          ...(write.serverTimes?.length
            ? {
                updateTransforms: write.serverTimes.map((fieldPath) => ({
                  fieldPath,
                  setToServerValue: "REQUEST_TIME",
                })),
              }
            : {}),
          ...(write.op === "upsert" ? {} : { currentDocument: { exists: write.op === "update" } }),
        };
      }),
    };
    await this.call(`${API}/projects/${this.projectId}/databases/(default)/documents:commit`, body);
  }
}
