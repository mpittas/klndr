# dayro. — product audit

*November 2026. Covers the web app, the phone app and the API as they are on `main`.*

dayro. is a calm, visual day planner: you drop time blocks onto an hour-by-hour timeline, keep a daily checklist of routines and jot notes for the day. It runs on the web and on phones, with or without an account.

---

## The short version

**What's strong:** planning a single day feels fast and pleasant. The timeline is direct and forgiving (drag, resize, overlap, undo), and small AI touches (emoji, category) remove busywork without getting in the way. The engineering underneath is solid and well tested.

**What's missing:** dayro. is great at *today* but weak at *every day*. Nothing repeats, nothing reminds you, nothing comes in from your real calendar, and nothing looks back at how your days went. Those four gaps are what stop it from becoming a daily habit.

**Do these next, in order:**

1. **Repeating blocks** (every day, weekdays, weekly).
2. **Reminders** when a block is about to start (phone first).
3. **Carry over unfinished blocks** to today, in one tap.
4. **A weekly review** (planned vs. done, time per category, checklist streaks).
5. **Read-only calendar overlay** (Google / Apple) so meetings show up as blocks.

---

## 1. What's good today

### Planning a day
- **The timeline is a joy to use.** Blocks snap to 15 minutes, can be dragged and resized, sit side by side when they overlap, and can be nudged with the arrow keys. Undo and redo work across the whole day.
- **The right-click menu covers real needs:** edit, mark done, duplicate, split, start now, move or copy to tomorrow, change category, delete.
- **Activities (templates) save typing.** Saved activities, grouped by category with an emoji and a default length, can be dragged straight onto the day.
- **Done vs. to-do is now clear at a glance:** done blocks fade to grey and are struck through, and open ones keep their color.

### Smart, quiet AI
- **Emoji and category are picked from the name as you type,** from your own history first and then from a small model. Saving never waits for it, and a choice you make by hand is never overwritten.
- **Colors stay distinct.** New categories get a free color, and clashes are fixed automatically.

### Beyond the timeline
- **The daily checklist** separates habits from timed work: default routines every day, plus per-day skips and one-off items.
- **Day notes** in Markdown.
- **The month view** has a grid with category dots, a "today" card, a 14-day agenda, a time-per-category breakdown and keyboard shortcuts.

### Trust and reach
- **Guest mode** works with no sign-up (data stays in the browser), and the demo week makes the first look feel alive.
- **Changes sync live** across tabs and devices, with instant updates that roll back if the server says no.
- **There's a native phone app** sharing the same core logic as the web (one set of rules, one set of tests).
- **Account deletion, policies and app store paperwork** are largely in place.
- **The design is calm and consistent** (warm paper look, light and dark, accessible labels throughout).

### Engineering
- **Around 650 automated tests** across core, data and API, with shared packages so web and phone can't drift in behavior.

---

## 2. What can be improved

### Product gaps in what already exists
- **Unfinished blocks just sit in the past.** Yesterday's undone blocks stay where they were. Offer "Move unfinished to today" (one tap, on the day header, or as a prompt the first time you open today).
- **"Copy to tomorrow" is the only way to repeat.** People re-create the same morning routine block every day. This is a stopgap for real repeating blocks (see section 3).
- **Old blocks are all "General".** Before smart categories, everything landed in General. Offer a one-time "Sort my past blocks" that runs the same AI pick over old blocks, with a review step before saving.
- **Insights are shallow.** The month view shows hours per category, but not planned vs. done, how this week compares to last, or checklist streaks. The data is already there.
- **Search covers activities only.** There's no way to find "dentist" across days.
- **The day view lacks the month view's shortcuts.** Add ← / → for previous / next day, T for today and N for a new block, so both views feel the same.

### Phone app parity
- **The phone's block form doesn't pick an emoji automatically.** It starts at 📌, while the web picks one as you type. The phone's activity and category forms already do it.
- **The phone hasn't got the new looks.** Its colors come from the design-token package, which is out of sync with the web's styles (3 token tests fail). As a result, the clearer done/not-done styling hasn't reached the phone. Regenerating the tokens and fixing the drift would bring both in line.

### Release blockers and risks
- **Sign in with Apple is still pending.** Apple requires it on iOS when Google sign-in is offered, so the iOS release is blocked until it's set up (see `docs/mobile-port/HUMAN_TODO.md`).
- **Firestore rules must ship with the emoji/category release,** otherwise creating categories is refused in production.
- **There's no data export.** People trust a planner more when they can take their data with them (JSON / CSV, or .ics for blocks).

---

## 3. New features that would add real value

Ranked by value for the effort, highest first.

| # | Feature | Why it matters | Effort |
|---|---------|----------------|--------|
| 1 | **Repeating blocks** — every day, weekdays, chosen days, every week; edit "this one" or "all future" | The single biggest reason planners get abandoned: re-entering the same routine daily. | Medium |
| 2 | **Reminders** — "starts in 5 min" notifications on the phone, browser notifications on the web; per block or a default | Turns a plan into something that actually happens. | Medium |
| 3 | **Carry over + end-of-day review** — at night or next morning: "3 blocks left: move to tomorrow / drop" | Closes the loop on every day; builds the habit. | Small |
| 4 | **Weekly review page** — planned vs. done, hours per category, best day, checklist streaks, compared with last week | Gives a reason to come back on Sunday; uses data you already have. | Small–medium |
| 5 | **Calendar overlay** — show Google / Apple calendar events as read-only blocks on the timeline | Real days have meetings; planning around them is the core use case. | Medium–large |
| 6 | **Week view** — 7 columns of the same timeline; drag blocks between days | Planning a week day by day is slow; the month view is overview only. | Medium |
| 7 | **Unscheduled inbox** — a list of to-dos with no time yet, dragged onto the day when you're ready | Captures tasks the moment they come up, without forcing a time. | Small–medium |
| 8 | **Day templates** — save "Workday" or "Weekend" and apply a whole day at once | Fast setup for structured people; pairs well with repeating blocks. | Small |
| 9 | **"Plan my day" with AI** — paste or speak a list, get suggested blocks around what's already planned | Builds on the AI you already have; a clear "wow" moment for the landing page. | Medium |
| 10 | **Now / Next widget** — phone home-screen and lock-screen widget showing the current and next block | Keeps the plan in view without opening the app. | Medium |
| 11 | **Focus mode** — "Start now" opens a full-screen timer for the current block | Natural next step after "Start now"; good for deep work. | Small |
| 12 | **Export and backup** — JSON / CSV, and .ics for blocks | Trust, portability, and it unblocks power users. | Small |

### Nice to have later
- Sharing a day or week as a read-only link (with a partner or coach).
- Energy or mood tag per day, shown in the weekly review.
- Natural-language quick add ("gym tomorrow 6pm 1h").
- Siri Shortcuts / Android intents ("Add a block").

---

## 4. Suggested roadmap

- **Next 2 weeks — make it a daily habit:** carry over unfinished blocks, repeating blocks, day view shortcuts, phone emoji parity and the token fix.
- **Next month — make it reliable:** reminders, the weekly review, "Sort my past blocks", data export, Sign in with Apple and the iOS release.
- **After that — make it the place your day lives:** calendar overlay, week view, unscheduled inbox, then "Plan my day" with AI and widgets.
