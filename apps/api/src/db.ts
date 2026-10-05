import type {
  ActivityTemplate,
  Category,
  ChecklistItem,
  DayChecklist,
  DayExtraItem,
  DayNotes,
  ScheduledTask,
  Store,
} from "@klndr/core";
import { MAX_DAY_EXTRAS, toISODate } from "@klndr/core";
import { HttpError } from "./errors";
import { Firestore, FirestoreError, type FsDoc } from "./firestore";
import type { Session } from "./session";

// The `Store` interface and the shared limits (MAX_DAY_EXTRAS, MAX_NOTES_LENGTH) live in
// @klndr/core, beside the types they describe. Below: the two implementations of it.

const emptyNotes = (day: string): DayNotes => ({ day, text: "" });

const emptyDay = (day: string): DayChecklist => ({ day, completedItemIds: [], hiddenItemIds: [], extraItems: [] });

const tooManyExtras = () =>
  new HttpError(400, `A day can have at most ${MAX_DAY_EXTRAS} one-off items`);

/** Apply a day edit to a copy of `state`; shared by both stores so they behave the same. */
function editDay(state: DayChecklist, edit: (draft: DayChecklist) => void): DayChecklist {
  const draft: DayChecklist = {
    day: state.day,
    completedItemIds: [...state.completedItemIds],
    hiddenItemIds: [...state.hiddenItemIds],
    extraItems: state.extraItems.map((e) => ({ ...e })),
  };
  edit(draft);
  return draft;
}

const withMember = (list: string[], id: string, present: boolean) =>
  present ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);

// Seed data
const DEFAULT_TEMPLATES = [
  {
    name: "Cleaning",
    emoji: "🧹",
    color: "cyan",
    category: "Home",
    defaultDuration: 45,
    notes: "Tidy a room, dishes, laundry or a quick vacuum run.",
  },
  {
    name: "Deep clean",
    emoji: "🧼",
    color: "teal",
    category: "Home",
    defaultDuration: 120,
    notes: "Bathroom, kitchen, floors — the full reset.",
  },
  {
    name: "Working on projects",
    emoji: "🛠️",
    color: "indigo",
    category: "Work",
    defaultDuration: 120,
    notes: "Focused maker time on the current project.",
  },
  {
    name: "Emails & admin",
    emoji: "📬",
    color: "slate",
    category: "Work",
    defaultDuration: 30,
    notes: "Inbox zero and small admin chores.",
  },
  {
    name: "Meeting",
    emoji: "👥",
    color: "violet",
    category: "Work",
    defaultDuration: 60,
    notes: "Calls, standups and check-ins.",
  },
  {
    name: "Workout",
    emoji: "🏋️",
    color: "emerald",
    category: "Health",
    defaultDuration: 60,
    notes: "Lift, run, swim or a class.",
  },
  {
    name: "Walk outside",
    emoji: "🚶",
    color: "lime",
    category: "Health",
    defaultDuration: 30,
    notes: "Fresh air and steps.",
  },
  {
    name: "Morning routine",
    emoji: "☀️",
    color: "amber",
    category: "Daily routines",
    defaultDuration: 45,
    notes: "Stretch, journal, coffee, plan the day.",
  },
  {
    name: "Meals",
    emoji: "🍽️",
    color: "orange",
    category: "Daily routines",
    defaultDuration: 45,
    notes: "Cook and eat — breakfast, lunch or dinner.",
  },
  {
    name: "Evening wind-down",
    emoji: "🌙",
    color: "sky",
    category: "Daily routines",
    defaultDuration: 30,
    notes: "Screens off, read, prep tomorrow.",
  },
  {
    name: "Study / learning",
    emoji: "📚",
    color: "rose",
    category: "Growth",
    defaultDuration: 60,
    notes: "Course, reading or deliberate practice.",
  },
  {
    name: "Errands",
    emoji: "🛒",
    color: "pink",
    category: "Home",
    defaultDuration: 60,
    notes: "Groceries, post office, pickups.",
  },
];

const DEFAULT_CHECKLIST_ITEMS = [
  { title: "Take vitamins & pills", emoji: "💊", order: 1 },
  { title: "Drink protein shake", emoji: "🥤", order: 2 },
  { title: "Morning shower", emoji: "🚿", order: 3 },
  { title: "Drink 2L water", emoji: "💧", order: 4 },
  { title: "10 min stretch / meditate", emoji: "🧘", order: 5 },
];

function isoOffset(days: number): string {
  const dateObj = new Date();
  dateObj.setDate(dateObj.getDate() + days);
  return toISODate(dateObj);
}

/** Demo schedule shared by both stores: [template name, day offset, start minutes]. */
const DEMO_PLAN: ReadonlyArray<readonly [string, number, number]> = [
  ["Morning routine", 0, 7 * 60],
  ["Working on projects", 0, 9 * 60],
  ["Emails & admin", 0, 11 * 60 + 30],
  ["Meals", 0, 12 * 60 + 30],
  ["Workout", 0, 18 * 60],
  ["Morning routine", 1, 7 * 60],
  ["Deep clean", 1, 10 * 60],
  ["Study / learning", 1, 15 * 60],
  ["Errands", 2, 13 * 60],
];

function demoTasks(
  templates: ActivityTemplate[],
): Omit<ScheduledTask, "id" | "completed">[] {
  const byName = new Map(templates.map((t) => [t.name, t]));
  return DEMO_PLAN.flatMap(([name, dayOffset, start]) => {
    const t = byName.get(name);
    if (!t) return [];
    return [
      {
        templateId: t.id,
        title: t.name,
        emoji: t.emoji,
        color: t.color,
        category: t.category,
        day: isoOffset(dayOffset),
        startMinutes: start,
        durationMinutes: t.defaultDuration,
        notes: t.notes,
      },
    ];
  });
}


const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const byCategoryName = (a: Category, b: Category) => a.name.localeCompare(b.name);

const duplicateCategory = () =>
  new HttpError(409, "A category with that name already exists");

/** One category per distinct name already used by the templates (existing accounts, first run). */
const categoriesFromTemplates = (templates: ActivityTemplate[]): Omit<Category, "id">[] => {
  const seen = new Map<string, Omit<Category, "id">>();
  for (const t of templates) {
    if (t.category && !seen.has(t.category)) {
      seen.set(t.category, { name: t.category, color: t.color || "slate" });
    }
  }
  return [...seen.values()];
};

/** Where a deleted category's activities go; null when it has none and no target was given. */
function resolveMoveTarget(categories: Category[], doomed: Category, moveTo: string | null, inUse: boolean): string | null {
  if (!moveTo) {
    if (inUse) throw new HttpError(400, "Choose a category to move its activities to");
    return null;
  }
  const target = categories.find((c) => c.id !== doomed.id && sameName(c.name, moveTo));
  if (!target) throw new HttpError(400, "That category to move to doesn't exist");
  return target.name;
}

/**
 * Scheduled blocks copy their template's color, so a recolor has to reach them too. Blocks are
 * linked by `templateId`; older drag-and-drop blocks were saved unlinked, so those match on the
 * template's name and category as it was before this edit.
 */
const followsTemplate = (task: ScheduledTask, prev: ActivityTemplate) =>
  task.templateId === prev.id ||
  (task.templateId === null && task.title === prev.name && task.category === prev.category);

const byTemplateOrder = (a: ActivityTemplate, b: ActivityTemplate) =>
  a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
const byStart = (a: ScheduledTask, b: ScheduledTask) =>
  a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes || a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------
// In-memory store: local development only, used when Firebase isn't configured.
// ---------------------------------------------------------------------------
class MemoryStore implements Store {
  private templates: ActivityTemplate[] = [];
  private categories: Category[] = [];
  private tasks: ScheduledTask[] = [];
  private checklistItems: ChecklistItem[] = [];
  private checklistDays = new Map<string, DayChecklist>();
  private notes = new Map<string, DayNotes>();
  private seq = 1;

  constructor() {
    for (const tpl of DEFAULT_TEMPLATES) {
      this.templates.push({ id: String(this.seq++), ...tpl, archived: false });
    }
    for (const category of categoriesFromTemplates(this.templates)) {
      this.categories.push({ id: String(this.seq++), ...category });
    }
    for (const task of demoTasks(this.templates)) {
      this.tasks.push({ id: String(this.seq++), ...task, completed: false });
    }
    for (const item of DEFAULT_CHECKLIST_ITEMS) {
      this.checklistItems.push({ id: String(this.seq++), ...item, archived: false });
    }
    // Demo completion for today: mark first 2 items completed
    const today = toISODate(new Date());
    if (this.checklistItems.length >= 2) {
      this.checklistDays.set(today, {
        ...emptyDay(today),
        completedItemIds: [this.checklistItems[0].id, this.checklistItems[1].id],
      });
    }
  }

  async listTemplates() {
    return [...this.templates].sort(byTemplateOrder);
  }

  async createTemplate(draft: Omit<ActivityTemplate, "id" | "archived">) {
    const item: ActivityTemplate = { id: String(this.seq++), ...draft, archived: false };
    this.templates.push(item);
    return item;
  }

  async updateTemplate(id: string, patch: Partial<Omit<ActivityTemplate, "id">>) {
    const idx = this.templates.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const prev = this.templates[idx];
    this.templates[idx] = { ...prev, ...patch, id };
    const { color } = this.templates[idx];
    if (color !== prev.color) {
      this.tasks = this.tasks.map((t) => (followsTemplate(t, prev) ? { ...t, color } : t));
    }
    return this.templates[idx];
  }

  async deleteTemplate(id: string) {
    const before = this.templates.length;
    this.templates = this.templates.filter((t) => t.id !== id);
    this.tasks = this.tasks.map((t) => (t.templateId === id ? { ...t, templateId: null } : t));
    return this.templates.length < before;
  }

  async listCategories() {
    return [...this.categories].sort(byCategoryName);
  }

  async createCategory(draft: Omit<Category, "id">) {
    if (this.categories.some((c) => sameName(c.name, draft.name))) throw duplicateCategory();
    const item: Category = { id: String(this.seq++), ...draft };
    this.categories.push(item);
    return item;
  }

  private recategorize(from: string, to: string) {
    this.templates = this.templates.map((t) => (t.category === from ? { ...t, category: to } : t));
    this.tasks = this.tasks.map((t) => (t.category === from ? { ...t, category: to } : t));
  }

  async updateCategory(id: string, patch: Partial<Omit<Category, "id">>) {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const prev = this.categories[idx];
    if (patch.name !== undefined && this.categories.some((c) => c.id !== id && sameName(c.name, patch.name!))) {
      throw duplicateCategory();
    }
    const next: Category = { ...prev, ...patch, id };
    this.categories[idx] = next;
    if (next.name !== prev.name) this.recategorize(prev.name, next.name);
    return next;
  }

  async deleteCategory(id: string, moveTo: string | null, deleteActivities = false) {
    const doomed = this.categories.find((c) => c.id === id);
    if (!doomed) return false;
    if (deleteActivities) {
      for (const t of this.templates.filter((t) => t.category === doomed.name)) await this.deleteTemplate(t.id);
    } else {
      const inUse = this.templates.some((t) => t.category === doomed.name);
      const target = resolveMoveTarget(this.categories, doomed, moveTo, inUse);
      if (target) this.recategorize(doomed.name, target);
    }
    this.categories = this.categories.filter((c) => c.id !== id);
    return true;
  }

  async ensureCategory(name: string) {
    const hit = this.categories.find((c) => sameName(c.name, name));
    if (hit) return hit.name;
    this.categories.push({ id: String(this.seq++), name, color: "slate" });
    return name;
  }

  async listTasksForDay(day: string) {
    return this.tasks.filter((t) => t.day === day).sort(byStart);
  }

  async listTasksBetween(from: string, to: string) {
    return this.tasks.filter((t) => t.day >= from && t.day <= to).sort(byStart);
  }

  async createTask(draft: Omit<ScheduledTask, "id">) {
    const owns = draft.templateId !== null && this.templates.some((t) => t.id === draft.templateId);
    const item: ScheduledTask = { id: String(this.seq++), ...draft, templateId: owns ? draft.templateId : null };
    this.tasks.push(item);
    return item;
  }

  async updateTask(id: string, patch: Partial<Omit<ScheduledTask, "id" | "templateId">>) {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = { ...this.tasks[idx], ...patch, id };
    return this.tasks[idx];
  }

  async deleteTask(id: string) {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return this.tasks.length < before;
  }

  async listChecklistItems() {
    return [...this.checklistItems]
      .filter((i) => !i.archived)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  async createChecklistItem(draft: Omit<ChecklistItem, "id" | "archived">) {
    const maxOrder = this.checklistItems.reduce((max, i) => Math.max(max, i.order), 0);
    const item: ChecklistItem = {
      id: String(this.seq++),
      ...draft,
      order: draft.order ?? maxOrder + 1,
      archived: false,
    };
    this.checklistItems.push(item);
    return item;
  }

  async updateChecklistItem(id: string, patch: Partial<Omit<ChecklistItem, "id">>) {
    const idx = this.checklistItems.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.checklistItems[idx] = { ...this.checklistItems[idx], ...patch, id };
    return this.checklistItems[idx];
  }

  async deleteChecklistItem(id: string) {
    const before = this.checklistItems.length;
    this.checklistItems = this.checklistItems.filter((i) => i.id !== id);
    for (const [day, state] of this.checklistDays) {
      this.checklistDays.set(
        day,
        editDay(state, (d) => {
          d.completedItemIds = withMember(d.completedItemIds, id, false);
          d.hiddenItemIds = withMember(d.hiddenItemIds, id, false);
        }),
      );
    }
    return this.checklistItems.length < before;
  }

  async getDayChecklist(day: string) {
    return this.checklistDays.get(day) ?? emptyDay(day);
  }

  private editDayChecklist(day: string, edit: (draft: DayChecklist) => void) {
    const next = editDay(this.checklistDays.get(day) ?? emptyDay(day), edit);
    this.checklistDays.set(day, next);
    return next;
  }

  async toggleDayChecklistItem(day: string, itemId: string, completed: boolean) {
    return this.editDayChecklist(day, (d) => {
      d.completedItemIds = withMember(d.completedItemIds, itemId, completed);
    });
  }

  async setDayChecklistItemHidden(day: string, itemId: string, hidden: boolean) {
    return this.editDayChecklist(day, (d) => {
      d.hiddenItemIds = withMember(d.hiddenItemIds, itemId, hidden);
    });
  }

  async addDayChecklistExtra(day: string, draft: Omit<DayExtraItem, "id">) {
    if ((this.checklistDays.get(day)?.extraItems.length ?? 0) >= MAX_DAY_EXTRAS) throw tooManyExtras();
    return this.editDayChecklist(day, (d) => {
      d.extraItems.push({ id: String(this.seq++), ...draft });
    });
  }

  async removeDayChecklistExtra(day: string, id: string) {
    return this.editDayChecklist(day, (d) => {
      d.extraItems = d.extraItems.filter((e) => e.id !== id);
      d.completedItemIds = withMember(d.completedItemIds, id, false);
    });
  }

  async getDayNotes(day: string) {
    return this.notes.get(day) ?? emptyNotes(day);
  }

  async setDayNotes(day: string, text: string) {
    const next = { day, text };
    this.notes.set(day, next);
    return next;
  }

  /** Forget everything this user had: in memory there are no documents to delete one by one. */
  async deleteAccount() {
    this.templates = [];
    this.categories = [];
    this.tasks = [];
    this.checklistItems = [];
    this.checklistDays.clear();
    this.notes.clear();
  }
}

// ---------------------------------------------------------------------------
// Firestore store: users/{uid}/templates/{id} and users/{uid}/tasks/{id}.
// Runs as the caller (their ID token), so firestore.rules is always enforced.
// ---------------------------------------------------------------------------
const toTemplate = ({ id, data }: FsDoc): ActivityTemplate => ({
  id,
  name: String(data.name ?? ""),
  emoji: String(data.emoji ?? ""),
  color: String(data.color ?? ""),
  category: String(data.category ?? ""),
  defaultDuration: Number(data.defaultDuration ?? 60),
  notes: (data.notes as string | null) ?? null,
  archived: data.archived === true,
});

const toTask = ({ id, data }: FsDoc): ScheduledTask => ({
  id,
  templateId: (data.templateId as string | null) ?? null,
  title: String(data.title ?? ""),
  emoji: String(data.emoji ?? ""),
  color: String(data.color ?? ""),
  category: String(data.category ?? ""),
  day: String(data.day ?? ""),
  startMinutes: Number(data.startMinutes ?? 0),
  durationMinutes: Number(data.durationMinutes ?? 60),
  notes: (data.notes as string | null) ?? null,
  completed: data.completed === true,
  lane: typeof data.lane === "number" ? data.lane : undefined,
});

const toCategory = ({ id, data }: FsDoc): Category => ({
  id,
  name: String(data.name ?? ""),
  color: String(data.color ?? "slate"),
  ...(typeof data.emoji === "string" && data.emoji ? { emoji: data.emoji } : {}),
});

const toChecklistItem = ({ id, data }: FsDoc): ChecklistItem => ({
  id,
  title: String(data.title ?? ""),
  emoji: String(data.emoji ?? "✅"),
  order: Number(data.order ?? 0),
  archived: data.archived === true,
});

/** Turn Firestore failures into API errors; `null`-returning callers handle NOT_FOUND first. */
function rethrow(err: unknown): never {
  if (err instanceof HttpError) throw err; // already an API error (e.g. a validation limit)
  if (err instanceof FirestoreError) {
    if (err.status === 401) throw new HttpError(401, "Invalid or expired session");
    if (err.status === 403) throw new HttpError(403, "Not allowed");
    if (err.status === 503) throw new HttpError(503, "Database unavailable");
  }
  console.error("Firestore request failed:", err instanceof FirestoreError ? err.message : err);
  throw new HttpError(502, "Database error");
}

const newId = () => crypto.randomUUID();

/** Users whose starter data this server instance has already confirmed. */
const seededUsers = new Set<string>();
const checklistSeededUsers = new Set<string>();
const categorySeededUsers = new Set<string>();

class FirestoreStore implements Store {
  /** Every collection under `users/{uid}`; the profile document itself is not one of them. */
  private static readonly COLLECTIONS = [
    "templates",
    "categories",
    "tasks",
    "checklist_items",
    "checklist_days",
    "day_notes",
    "meta",
  ] as const;

  private readonly base: string;

  constructor(
    private readonly fs: Firestore,
    private readonly userId: string,
  ) {
    this.base = `users/${userId}`;
  }

  /**
   * Give a brand-new user the starter templates and a demo week, exactly once.
   * The marker document is created with an "must not exist" precondition, so
   * concurrent first requests can't both seed.
   */
  private async ensureSeeded(): Promise<void> {
    if (seededUsers.has(this.userId)) return;
    try {
      if (await this.fs.get(`${this.base}/meta/seed`)) {
        seededUsers.add(this.userId);
        return;
      }

      const templates = DEFAULT_TEMPLATES.map((tpl) => ({ id: newId(), ...tpl, archived: false }));
      await this.fs.commit([
        { op: "create", path: `${this.base}/meta/seed`, data: {}, serverTimes: ["seededAt"] },
        ...templates.map(({ id, ...data }) => ({
          op: "create" as const,
          path: `${this.base}/templates/${id}`,
          data,
          serverTimes: ["createdAt"],
        })),
      ]);
      seededUsers.add(this.userId);

      // Tasks link to templates, which rules verify against already-committed data.
      const demo = demoTasks(templates);
      if (demo.length) {
        await this.fs
          .commit(
            demo.map((task) => ({
              op: "create" as const,
              path: `${this.base}/tasks/${newId()}`,
              data: { ...task, completed: false },
              serverTimes: ["createdAt", "updatedAt"],
            })),
          )
          .catch((err) => console.warn("Demo tasks skipped:", err instanceof FirestoreError ? err.message : err));
      }
    } catch (err) {
      if (err instanceof FirestoreError && err.alreadyExists) {
        seededUsers.add(this.userId); // another request won the race
        return;
      }
      rethrow(err);
    }
  }

  /**
   * Give the user the default checklist (the list every day starts from), exactly once.
   * Separate from `ensureSeeded` so accounts created before the checklist existed get it too.
   * Marker and items are one atomic commit, so a failure never leaves a half-seeded list.
   */
  private async ensureChecklistSeeded(): Promise<void> {
    if (checklistSeededUsers.has(this.userId)) return;
    try {
      if (await this.fs.get(`${this.base}/meta/checklistSeed`)) {
        checklistSeededUsers.add(this.userId);
        return;
      }
      await this.fs.commit([
        { op: "create", path: `${this.base}/meta/checklistSeed`, data: {}, serverTimes: ["seededAt"] },
        ...DEFAULT_CHECKLIST_ITEMS.map((item) => ({
          op: "create" as const,
          path: `${this.base}/checklist_items/${newId()}`,
          data: { ...item, archived: false },
          serverTimes: ["createdAt"],
        })),
      ]);
      checklistSeededUsers.add(this.userId);
    } catch (err) {
      if (err instanceof FirestoreError && err.alreadyExists) {
        checklistSeededUsers.add(this.userId); // another request won the race
        return;
      }
      throw err;
    }
  }

  async listTemplates() {
    try {
      let docs = await this.fs.query(this.base, "templates");
      if (docs.length > 0) {
        seededUsers.add(this.userId); // existing user: skip the seed-marker lookup from now on
      } else {
        await this.ensureSeeded();
        docs = await this.fs.query(this.base, "templates");
      }
      return docs.map(toTemplate).sort(byTemplateOrder);
    } catch (err) {
      rethrow(err);
    }
  }

  async createTemplate(draft: Omit<ActivityTemplate, "id" | "archived">) {
    const id = newId();
    const data = { ...draft, archived: false };
    try {
      await this.fs.commit([{ op: "create", path: `${this.base}/templates/${id}`, data, serverTimes: ["createdAt"] }]);
    } catch (err) {
      rethrow(err);
    }
    return { id, ...data };
  }

  async updateTemplate(id: string, patch: Partial<Omit<ActivityTemplate, "id">>) {
    try {
      const before = patch.color !== undefined ? await this.fs.get(`${this.base}/templates/${id}`) : null;
      if (Object.keys(patch).length > 0) {
        await this.fs.commit([{ op: "update", path: `${this.base}/templates/${id}`, data: patch }]);
      }
      if (before && patch.color !== undefined) await this.recolorTasks(toTemplate(before), patch.color);
      const doc = await this.fs.get(`${this.base}/templates/${id}`);
      return doc ? toTemplate(doc) : null;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return null;
      rethrow(err);
    }
  }

  /** Give every scheduled block that came from `prev` the template's new color, in batches. */
  private async recolorTasks(prev: ActivityTemplate, color: string) {
    if (color === prev.color) return;
    const [linked, sameTitle] = await Promise.all([
      this.fs.query(this.base, "tasks", [{ field: "templateId", op: "EQUAL", value: prev.id }]),
      this.fs.query(this.base, "tasks", [{ field: "title", op: "EQUAL", value: prev.name }]),
    ]);
    const byId = new Map<string, ScheduledTask>();
    for (const doc of [...linked, ...sameTitle]) {
      const task = toTask(doc);
      if (followsTemplate(task, prev) && task.color !== color) byId.set(task.id, task);
    }
    const ids = [...byId.keys()];
    for (let i = 0; i < ids.length; i += 400) {
      await this.fs.commit(
        ids.slice(i, i + 400).map((taskId) => ({
          op: "update" as const,
          path: `${this.base}/tasks/${taskId}`,
          data: { color },
          serverTimes: ["updatedAt"],
        })),
      );
    }
  }

  async deleteTemplate(id: string) {
    try {
      // Mirror "on delete set null": unlink this template's tasks in the same atomic commit.
      const linked = await this.fs.query(this.base, "tasks", [{ field: "templateId", op: "EQUAL", value: id }]);
      await this.fs.commit([
        ...linked.map((task) => ({
          op: "update" as const,
          path: `${this.base}/tasks/${task.id}`,
          data: { templateId: null },
          serverTimes: ["updatedAt"],
        })),
        { op: "delete", path: `${this.base}/templates/${id}` },
      ]);
      return true;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return false;
      rethrow(err);
    }
  }

  /**
   * Turn the category names the templates already use into real categories, exactly once
   * (accounts created before categories existed). The marker stops a user who deletes every
   * category from getting them back.
   */
  private async ensureCategoriesSeeded(): Promise<void> {
    if (categorySeededUsers.has(this.userId)) return;
    try {
      if (await this.fs.get(`${this.base}/meta/categorySeed`)) {
        categorySeededUsers.add(this.userId);
        return;
      }
      const drafts = categoriesFromTemplates(await this.listTemplates());
      await this.fs.commit([
        { op: "create", path: `${this.base}/meta/categorySeed`, data: {}, serverTimes: ["seededAt"] },
        ...drafts.map((data) => ({
          op: "create" as const,
          path: `${this.base}/categories/${newId()}`,
          data,
          serverTimes: ["createdAt"],
        })),
      ]);
      categorySeededUsers.add(this.userId);
    } catch (err) {
      if (err instanceof FirestoreError && err.alreadyExists) {
        categorySeededUsers.add(this.userId); // another request won the race
        return;
      }
      throw err;
    }
  }

  async listCategories() {
    try {
      let docs = await this.fs.query(this.base, "categories");
      if (docs.length > 0) {
        categorySeededUsers.add(this.userId);
      } else {
        await this.ensureCategoriesSeeded();
        docs = await this.fs.query(this.base, "categories");
      }
      return docs.map(toCategory).sort(byCategoryName);
    } catch (err) {
      rethrow(err);
    }
  }

  async createCategory(draft: Omit<Category, "id">) {
    const id = newId();
    try {
      const existing = await this.listCategories();
      if (existing.some((c) => sameName(c.name, draft.name))) throw duplicateCategory();
      await this.fs.commit([{ op: "create", path: `${this.base}/categories/${id}`, data: draft, serverTimes: ["createdAt"] }]);
    } catch (err) {
      rethrow(err);
    }
    return { id, ...draft };
  }

  /** Point every template and task in category `from` at category `to`, in batches. */
  private async recategorize(from: string, to: string) {
    if (from === to) return;
    const where = [{ field: "category", op: "EQUAL" as const, value: from }];
    for (;;) {
      const [templates, tasks] = await Promise.all([
        this.fs.query(this.base, "templates", where, 200),
        this.fs.query(this.base, "tasks", where, 200),
      ]);
      if (templates.length === 0 && tasks.length === 0) return;
      await this.fs.commit([
        ...templates.map((t) => ({ op: "update" as const, path: `${this.base}/templates/${t.id}`, data: { category: to } })),
        ...tasks.map((t) => ({
          op: "update" as const,
          path: `${this.base}/tasks/${t.id}`,
          data: { category: to },
          serverTimes: ["updatedAt"],
        })),
      ]);
    }
  }

  async updateCategory(id: string, patch: Partial<Omit<Category, "id">>) {
    try {
      const doc = await this.fs.get(`${this.base}/categories/${id}`);
      if (!doc) return null;
      const prev = toCategory(doc);
      if (patch.name !== undefined) {
        const others = (await this.listCategories()).filter((c) => c.id !== id);
        if (others.some((c) => sameName(c.name, patch.name!))) throw duplicateCategory();
      }
      if (Object.keys(patch).length > 0) {
        await this.fs.commit([{ op: "update", path: `${this.base}/categories/${id}`, data: patch }]);
      }
      const next: Category = { ...prev, ...patch, id };
      if (next.name !== prev.name) await this.recategorize(prev.name, next.name);
      return next;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return null;
      rethrow(err);
    }
  }

  async deleteCategory(id: string, moveTo: string | null, deleteActivities = false) {
    try {
      const doc = await this.fs.get(`${this.base}/categories/${id}`);
      if (!doc) return false;
      const doomed = toCategory(doc);
      const where = [{ field: "category", op: "EQUAL" as const, value: doomed.name }];
      if (deleteActivities) {
        for (const t of await this.fs.query(this.base, "templates", where)) await this.deleteTemplate(t.id);
      } else {
        const inUse = (await this.fs.query(this.base, "templates", where, 1)).length > 0;
        const target = resolveMoveTarget(await this.listCategories(), doomed, moveTo, inUse);
        if (target) await this.recategorize(doomed.name, target);
      }
      await this.fs.commit([{ op: "delete", path: `${this.base}/categories/${id}` }]);
      return true;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return false;
      rethrow(err);
    }
  }

  async ensureCategory(name: string) {
    const hit = (await this.listCategories()).find((c) => sameName(c.name, name));
    if (hit) return hit.name;
    try {
      await this.createCategory({ name, color: "slate" });
    } catch (err) {
      if (!(err instanceof HttpError && err.status === 409)) throw err; // lost a race: it exists now
    }
    return name;
  }

  async listTasksForDay(day: string) {
    try {
      await this.ensureSeeded();
      const docs = await this.fs.query(this.base, "tasks", [{ field: "day", op: "EQUAL", value: day }]);
      return docs.map(toTask).sort(byStart);
    } catch (err) {
      rethrow(err);
    }
  }

  async listTasksBetween(from: string, to: string) {
    try {
      await this.ensureSeeded();
      const docs = await this.fs.query(this.base, "tasks", [
        { field: "day", op: "GREATER_THAN_OR_EQUAL", value: from },
        { field: "day", op: "LESS_THAN_OR_EQUAL", value: to },
      ]);
      return docs.map(toTask).sort(byStart);
    } catch (err) {
      rethrow(err);
    }
  }

  async createTask(draft: Omit<ScheduledTask, "id">): Promise<ScheduledTask> {
    const id = newId();
    try {
      await this.fs.commit([
        { op: "create", path: `${this.base}/tasks/${id}`, data: draft, serverTimes: ["createdAt", "updatedAt"] },
      ]);
    } catch (err) {
      // Rules reject a link to a template the caller doesn't own; store the task unlinked instead.
      if (err instanceof FirestoreError && err.status === 403 && draft.templateId !== null) {
        return this.createTask({ ...draft, templateId: null });
      }
      rethrow(err);
    }
    return { id, ...draft };
  }

  async updateTask(id: string, patch: Partial<Omit<ScheduledTask, "id" | "templateId">>) {
    try {
      await this.fs.commit([
        { op: "update", path: `${this.base}/tasks/${id}`, data: patch, serverTimes: ["updatedAt"] },
      ]);
      const doc = await this.fs.get(`${this.base}/tasks/${id}`);
      return doc ? toTask(doc) : null;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return null;
      rethrow(err);
    }
  }

  async deleteTask(id: string) {
    try {
      await this.fs.commit([{ op: "delete", path: `${this.base}/tasks/${id}` }]);
      return true;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return false;
      rethrow(err);
    }
  }

  async listChecklistItems() {
    try {
      await this.ensureChecklistSeeded();
      const docs = await this.fs.query(this.base, "checklist_items");
      return docs
        .map(toChecklistItem)
        .filter((i) => !i.archived)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    } catch (err) {
      rethrow(err);
    }
  }

  async createChecklistItem(draft: Omit<ChecklistItem, "id" | "archived">) {
    const id = newId();
    const data = { ...draft, archived: false };
    try {
      await this.fs.commit([
        { op: "create", path: `${this.base}/checklist_items/${id}`, data, serverTimes: ["createdAt"] },
      ]);
    } catch (err) {
      rethrow(err);
    }
    return { id, ...data };
  }

  async updateChecklistItem(id: string, patch: Partial<Omit<ChecklistItem, "id">>) {
    try {
      if (Object.keys(patch).length > 0) {
        await this.fs.commit([{ op: "update", path: `${this.base}/checklist_items/${id}`, data: patch }]);
      }
      const doc = await this.fs.get(`${this.base}/checklist_items/${id}`);
      return doc ? toChecklistItem(doc) : null;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return null;
      rethrow(err);
    }
  }

  async deleteChecklistItem(id: string) {
    try {
      await this.fs.commit([{ op: "delete", path: `${this.base}/checklist_items/${id}` }]);
      return true;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return false;
      rethrow(err);
    }
  }

  private async readDay(day: string): Promise<{ state: DayChecklist; exists: boolean }> {
    const doc = await this.fs.get(`${this.base}/checklist_days/${day}`);
    if (!doc) return { state: emptyDay(day), exists: false };
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
    const extras = Array.isArray(doc.data.extraItems) ? (doc.data.extraItems as Array<Record<string, unknown>>) : [];
    return {
      exists: true,
      state: {
        day,
        completedItemIds: ids(doc.data.completedItemIds),
        hiddenItemIds: ids(doc.data.hiddenItemIds),
        extraItems: extras.map((e) => ({
          id: String(e.id ?? ""),
          title: String(e.title ?? ""),
          emoji: String(e.emoji ?? "✅"),
        })),
      },
    };
  }

  async getDayChecklist(day: string) {
    try {
      await this.ensureSeeded();
      return (await this.readDay(day)).state;
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return emptyDay(day);
      rethrow(err);
    }
  }

  /** Read-modify-write one day's document, creating it on first use. */
  private async editDayChecklist(day: string, edit: (draft: DayChecklist) => void) {
    try {
      const { state, exists } = await this.readDay(day);
      const next = editDay(state, edit);
      await this.fs.commit([
        {
          op: exists ? "update" : "create",
          path: `${this.base}/checklist_days/${day}`,
          data: {
            day,
            completedItemIds: next.completedItemIds,
            hiddenItemIds: next.hiddenItemIds,
            extraItems: next.extraItems,
          },
          serverTimes: ["updatedAt"],
        },
      ]);
      return next;
    } catch (err) {
      rethrow(err);
    }
  }

  async toggleDayChecklistItem(day: string, itemId: string, completed: boolean) {
    return this.editDayChecklist(day, (d) => {
      d.completedItemIds = withMember(d.completedItemIds, itemId, completed);
    });
  }

  async setDayChecklistItemHidden(day: string, itemId: string, hidden: boolean) {
    return this.editDayChecklist(day, (d) => {
      d.hiddenItemIds = withMember(d.hiddenItemIds, itemId, hidden);
    });
  }

  async addDayChecklistExtra(day: string, draft: Omit<DayExtraItem, "id">) {
    return this.editDayChecklist(day, (d) => {
      if (d.extraItems.length >= MAX_DAY_EXTRAS) throw tooManyExtras();
      d.extraItems.push({ id: newId(), ...draft });
    });
  }

  async removeDayChecklistExtra(day: string, id: string) {
    return this.editDayChecklist(day, (d) => {
      d.extraItems = d.extraItems.filter((e) => e.id !== id);
      d.completedItemIds = withMember(d.completedItemIds, id, false);
    });
  }

  async getDayNotes(day: string) {
    try {
      const doc = await this.fs.get(`${this.base}/day_notes/${day}`);
      return doc ? { day, text: String(doc.data.text ?? "") } : emptyNotes(day);
    } catch (err) {
      if (err instanceof FirestoreError && err.notFound) return emptyNotes(day);
      rethrow(err);
    }
  }

  async setDayNotes(day: string, text: string) {
    try {
      const exists = (await this.fs.get(`${this.base}/day_notes/${day}`)) !== null;
      await this.fs.commit([
        {
          op: exists ? "update" : "create",
          path: `${this.base}/day_notes/${day}`,
          data: { day, text },
          serverTimes: ["updatedAt"],
        },
      ]);
      return { day, text };
    } catch (err) {
      rethrow(err);
    }
  }

  /**
   * Delete everything this user owns, and the profile document last: if that fails half way, the
   * leftovers still belong to a profile that says who owns them. Each collection is emptied in
   * batches, so an account of any size goes, and the in-memory seed markers are forgotten so a new
   * account starts afresh.
   */
  async deleteAccount() {
    try {
      for (const collection of FirestoreStore.COLLECTIONS) await this.empty(collection);
      await this.fs.commit([{ op: "delete", path: this.base, mustExist: false }]);
      seededUsers.delete(this.userId);
      checklistSeededUsers.delete(this.userId);
      categorySeededUsers.delete(this.userId);
    } catch (err) {
      rethrow(err);
    }
  }

  /** Delete one collection's documents, a batch at a time, until none is left. */
  private async empty(collectionId: string) {
    for (let round = 0; round < 50; round += 1) {
      const docs = await this.fs.query(this.base, collectionId, [], 300);
      if (!docs.length) return;
      await this.fs.commit(
        docs.map(({ id }) => ({
          op: "delete" as const,
          path: `${this.base}/${collectionId}/${id}`,
          mustExist: false,
        })),
      );
    }
    console.warn(`Stopped emptying ${this.base}/${collectionId}: still not empty after 50 rounds`);
  }
}

/**
 * Makes the store for a verified caller. Data lives in Firestore, read and written with the caller's
 * own ID token so `firestore.rules` applies. Without a token (local development without Firebase)
 * each user id gets its own in-memory store, which lasts as long as the returned factory does.
 */
export function createStoreFactory(firebaseProjectId: string): (session: Session) => Store {
  // One in-memory store per user, so the dev fallback keeps the same isolation.
  const memoryStores = new Map<string, MemoryStore>();
  return (session) => {
    if (session.idToken) {
      return new FirestoreStore(new Firestore(firebaseProjectId, session.idToken), session.userId);
    }
    let store = memoryStores.get(session.userId);
    if (!store) {
      store = new MemoryStore();
      memoryStores.set(session.userId, store);
    }
    return store;
  };
}
