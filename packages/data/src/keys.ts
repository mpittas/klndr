/**
 * Every query key in one place. They nest (`["tasks"]` covers every day and range of tasks), so
 * invalidating or reading a prefix reaches all of what is under it.
 */
export const queryKeys = {
  tasks: {
    all: ["tasks"] as const,
    day: (day: string) => ["tasks", "day", day] as const,
    range: (from: string, to: string) => ["tasks", "range", from, to] as const,
    ranges: ["tasks", "range"] as const,
  },
  templates: ["templates"] as const,
  categories: ["categories"] as const,
  checklist: {
    all: ["checklist"] as const,
    items: ["checklist", "items"] as const,
    day: (day: string) => ["checklist", "day", day] as const,
    days: ["checklist", "day"] as const,
  },
  notes: (day: string) => ["notes", day] as const,
  profile: ["profile"] as const,
};
