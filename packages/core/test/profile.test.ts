import { describe, expect, it } from "vitest";
import { DURATION_OPTIONS, PROFILE_LIMITS, cleanPatch, isValidTimeZone, loadOrCreateProfile, newProfileData, toProfile } from "../src/index";

describe("newProfileData", () => {
  const base = { uid: "u1", email: "ada@example.com" };

  it("starts from the same defaults the web app always used", () => {
    expect(newProfileData({ ...base, displayName: "Ada L", photoURL: "https://x/y.png", timezone: "Europe/Nicosia" })).toEqual({
      uid: "u1",
      email: "ada@example.com",
      displayName: "Ada L",
      photoURL: "https://x/y.png",
      bio: "",
      phone: "",
      location: "",
      timezone: "Europe/Nicosia",
      weekStartsOnMonday: true,
      defaultTaskDuration: 60,
    });
  });

  it("prefers the sign-up name, then the provider's, then the email's local part, then 'User'", () => {
    expect(newProfileData({ ...base, signUpName: "Typed", displayName: "Provider" }).displayName).toBe("Typed");
    expect(newProfileData({ ...base, displayName: "Provider" }).displayName).toBe("Provider");
    expect(newProfileData({ ...base, displayName: "" }).displayName).toBe("ada");
    expect(newProfileData({ uid: "u2", email: null }).displayName).toBe("User");
  });

  it("falls back to UTC and nulls, and caps what the rules cap", () => {
    const bare = newProfileData({ uid: "u2", email: undefined });
    expect(bare).toMatchObject({ email: null, photoURL: null, timezone: "UTC" });
    expect(newProfileData({ ...base, signUpName: "x".repeat(200) }).displayName).toHaveLength(PROFILE_LIMITS.displayName);
    expect(newProfileData({ ...base, timezone: "x".repeat(200) }).timezone).toHaveLength(PROFILE_LIMITS.timezone);
  });
});

describe("cleanPatch", () => {
  it("keeps only what was sent", () => {
    expect(cleanPatch({})).toEqual({});
    expect(cleanPatch({ bio: "hi" })).toEqual({ bio: "hi" });
  });

  it("trims a display name and refuses an empty or too long one", () => {
    expect(cleanPatch({ displayName: "  Ada  " })).toEqual({ displayName: "Ada" });
    expect(() => cleanPatch({ displayName: "   " })).toThrow("Display name can't be empty.");
    expect(() => cleanPatch({ displayName: "x".repeat(PROFILE_LIMITS.displayName + 1) })).toThrow(
      `Display name must be ${PROFILE_LIMITS.displayName} characters or fewer.`,
    );
    expect(cleanPatch({ displayName: "x".repeat(PROFILE_LIMITS.displayName) })).toHaveProperty("displayName");
  });

  it("caps the bio and the location", () => {
    expect(cleanPatch({ bio: "  hello  " })).toEqual({ bio: "hello" });
    expect(() => cleanPatch({ bio: "x".repeat(PROFILE_LIMITS.bio + 1) })).toThrow(`Bio must be ${PROFILE_LIMITS.bio} characters or fewer.`);
    expect(() => cleanPatch({ location: "x".repeat(PROFILE_LIMITS.location + 1) })).toThrow(
      `Location must be ${PROFILE_LIMITS.location} characters or fewer.`,
    );
  });

  it("allows digits and punctuation in a phone number only", () => {
    expect(cleanPatch({ phone: " +1 (555) 123-4567 " })).toEqual({ phone: "+1 (555) 123-4567" });
    expect(cleanPatch({ phone: "" })).toEqual({ phone: "" });
    expect(() => cleanPatch({ phone: "555-CALL" })).toThrow("Phone number can only contain digits, spaces and + ( ) - .");
    expect(() => cleanPatch({ phone: "1".repeat(PROFILE_LIMITS.phone + 1) })).toThrow();
  });

  it("accepts a real timezone and rejects the rest", () => {
    expect(cleanPatch({ timezone: " Europe/Nicosia " })).toEqual({ timezone: "Europe/Nicosia" });
    expect(cleanPatch({ timezone: "UTC" })).toEqual({ timezone: "UTC" });
    expect(() => cleanPatch({ timezone: "" })).toThrow("Timezone isn't recognised. Use a name like Europe/Nicosia or UTC.");
    expect(() => cleanPatch({ timezone: "Nowhere/Here" })).toThrow();
    expect(() => cleanPatch({ timezone: "x".repeat(PROFILE_LIMITS.timezone + 1) })).toThrow();
  });

  it("coerces the week start and checks the duration is one of the offered ones", () => {
    // The values below stand in for what Firestore or a form can hand over at runtime.
    const asFlag = (value: unknown) => value as boolean;
    const asDuration = (value: unknown) => value as number;

    expect(cleanPatch({ weekStartsOnMonday: false })).toEqual({ weekStartsOnMonday: false });
    expect(cleanPatch({ weekStartsOnMonday: asFlag(0) })).toEqual({ weekStartsOnMonday: false });
    expect(cleanPatch({ weekStartsOnMonday: asFlag("yes") })).toEqual({ weekStartsOnMonday: true });
    expect(cleanPatch({ defaultTaskDuration: 45 })).toEqual({ defaultTaskDuration: 45 });
    expect(cleanPatch({ defaultTaskDuration: asDuration("60") })).toEqual({ defaultTaskDuration: 60 });
    expect(() => cleanPatch({ defaultTaskDuration: 50 })).toThrow("Choose one of the listed block durations.");
    expect(() => cleanPatch({ defaultTaskDuration: 180 })).toThrow();
    for (const minutes of DURATION_OPTIONS) {
      expect(cleanPatch({ defaultTaskDuration: minutes })).toEqual({ defaultTaskDuration: minutes });
    }
  });
});

describe("isValidTimeZone", () => {
  it("asks Intl", () => {
    expect(isValidTimeZone("Europe/Nicosia")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Nowhere/Here")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("toProfile", () => {
  it("fills in the defaults for an empty document", () => {
    expect(toProfile("uid-1", {})).toEqual({
      uid: "uid-1",
      email: null,
      displayName: "",
      photoURL: null,
      bio: "",
      phone: "",
      location: "",
      timezone: "UTC",
      weekStartsOnMonday: true,
      defaultTaskDuration: 60,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });

  it("keeps the fields it knows and drops the rest", () => {
    const profile = toProfile("uid-1", {
      email: "a@b.com",
      displayName: "Ada",
      timezone: "Europe/Nicosia",
      weekStartsOnMonday: false,
      defaultTaskDuration: "90",
      createdAt: { toDate: () => new Date("2026-01-02T03:04:05.000Z") },
      updatedAt: { toDate: () => new Date("2026-02-03T04:05:06.000Z") },
      isAdmin: true,
    });
    expect(profile.email).toBe("a@b.com");
    expect(profile.displayName).toBe("Ada");
    expect(profile.timezone).toBe("Europe/Nicosia");
    expect(profile.weekStartsOnMonday).toBe(false);
    expect(profile.defaultTaskDuration).toBe(90);
    expect(profile.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(profile.updatedAt).toBe("2026-02-03T04:05:06.000Z");
    expect(profile).not.toHaveProperty("isAdmin");
  });

  it("falls back to an hour when the duration is missing or zero", () => {
    expect(toProfile("uid-1", { defaultTaskDuration: 0 }).defaultTaskDuration).toBe(60);
    expect(toProfile("uid-1", { defaultTaskDuration: "abc" }).defaultTaskDuration).toBe(60);
    expect(toProfile("uid-1", { defaultTaskDuration: 30 }).defaultTaskDuration).toBe(30);
  });

  it("only reads a timestamp out of a Firestore-style value", () => {
    expect(toProfile("uid-1", { createdAt: "2026-01-02" }).createdAt).toBeUndefined();
    expect(toProfile("uid-1", { createdAt: null }).createdAt).toBeUndefined();
  });
});

describe("loadOrCreateProfile", () => {
  const source = { uid: "u1", email: "ada@example.com", displayName: "Ada", timezone: "UTC" };

  const fakeDb = (existing: Record<string, any> | null = null) => {
    let stored = existing;
    const created: unknown[] = [];
    return {
      created,
      db: {
        read: async () => stored,
        create: async (_uid: string, fields: Record<string, any>) => {
          created.push(fields);
          stored = { ...fields, createdAt: { toDate: () => new Date("2026-01-02T03:04:05Z") } };
        },
      },
    };
  };

  it("returns an existing profile without writing anything", async () => {
    const { db, created } = fakeDb({ displayName: "Existing", email: "e@x.y", weekStartsOnMonday: false });
    const profile = await loadOrCreateProfile(db, source);
    expect(profile).toMatchObject({ uid: "u1", displayName: "Existing", weekStartsOnMonday: false });
    expect(created).toHaveLength(0);
  });

  it("creates the profile on a first sign-in and reads it back", async () => {
    const { db, created } = fakeDb();
    const profile = await loadOrCreateProfile(db, { ...source, signUpName: "Ada Lovelace" });
    expect(created).toEqual([newProfileData({ ...source, signUpName: "Ada Lovelace" })]);
    expect(profile).toMatchObject({ displayName: "Ada Lovelace", defaultTaskDuration: 60, createdAt: "2026-01-02T03:04:05.000Z" });
  });

  it("says so when the document cannot be read after it was created", async () => {
    await expect(loadOrCreateProfile({ read: async () => null, create: async () => {} }, source)).rejects.toThrow(
      "The profile could not be created.",
    );
  });
});
