# App Store listing: copy to paste into App Store Connect

Draft text for the first release (English, U.S.). Character limits are Apple's. Edit freely; the facts below come
from what the app does today (Day timeline, quarter-hour blocks, routines, notes, calendar, library, sync).

## App Information (sidebar → App Information)

| Field | Value |
|---|---|
| Name (30) | `klndr` (fallbacks if taken: `klndr: Day Planner`, `klndr Planner`) |
| Subtitle (30) | `Plan your day, block by block` |
| Category | Productivity (secondary: Lifestyle) |
| Privacy Policy URL | `https://klndr.xyz/privacy` |
| Content rights | Does not contain third-party content |
| Age rating | answer "None" to every question → **4+** |

## Version page (sidebar → 1.0 Prepare for Submission)

**Promotional text (170)**

```
Give every part of your day a place. Block out your time in quarter-hour steps, repeat your routines, and keep your notes with the day they belong to.
```

**Keywords (100, comma-separated, no spaces)**

```
planner,day planner,schedule,timeline,time blocking,routine,checklist,calendar,daily,agenda
```

**Description (4000)**

```
klndr is a calm, fast day planner built around time blocks.

PLAN YOUR DAY ON A TIMELINE
Tap an empty slot to add a block, drag it to move it, and pull its edge to change how long it lasts. Times snap to quarter hours, so a day always looks tidy. A live line shows where you are right now.

KEEP YOUR ROUTINES
Add the things you do every day, like vitamins or a morning walk, and tick them off in a checklist. Skip one for a day without losing it, and restore it later.

A LIBRARY OF ACTIVITIES
Save the activities you repeat, such as Deep focus or Meals, and start a block from one in a tap. Group them in your own colour-coded categories, each with an emoji.

SEE THE MONTH
The calendar shows which days are busy, lets you filter by category, and lists what is coming up. Hold a day to add a block to it.

NOTES FOR EACH DAY
Write notes in Markdown, with tick-boxes you can check off in the preview, right next to the day they belong to.

EVERYWHERE YOU PLAN
Your plans sync between your iPhone and the web, and a change on one device appears on the other within moments. Light and dark themes follow your phone.

YOUR DATA IS YOURS
Sign in with Apple, Google or email. There are no ads and no tracking, and you can delete your account and everything in it from Settings at any time.
```

**What's new (first version)**: `First release.`

**Support URL**: `https://klndr.xyz` (it must load; a contact page is better if you add one)
**Marketing URL**: optional, leave empty.
**Copyright**: `2026 Marios Pittas`

## App Privacy (sidebar → App Privacy), the draft from RELEASE.md step 4

Collected, linked to the user, **not** used for tracking, purpose **App Functionality**:
Contact info (email address, name, phone number), Location (the free-text location in the profile is user content, not
device location; answer under "Other user content" if Apple's form does not offer free text), User content
(blocks, activities, notes, checklists), Identifiers (user id).
Third parties that receive data: Firebase/Google (storage and sign-in), Vercel (hosting), OpenAI (titles only, for
the emoji suggestion; disclosed in the privacy policy). No advertising, no analytics SDK.

## Screenshots (version page → iPhone 6.9" display, 3 to 10 images)

Take them on the **iPhone 18 Pro Max** simulator (or any 6.9" device), in demo data, light mode, with the status bar
clean. Suggested order:
1. Day timeline with a few blocks
2. New block sheet (title, times, category)
3. Calendar month with a day selected
4. Library (activities and categories)
5. Day notes with a ticked checklist
6. Dark mode Day timeline

## App Review Information (version page, bottom)

- Sign-in required: **yes**. Demo account: `<email>` / `<password>` (create it in the production app first).
- Notes:

```
klndr is a daily planner. Sign in with the demo account above (email and password).
- Add a block: tap the + button on the Day tab, give it a title, tap the check mark.
- Move a block: touch and hold, then drag. Tick a block with the circle at its right edge.
- Library tab: activities and categories. Calendar tab: month view.
- Settings: profile, theme, and "Delete account" (account deletion is available in the app).
Sign in with Apple and Google are also offered on the sign-in screen.
The emoji for a block is suggested by an AI service from the title only; this is described in the privacy policy.
```

- Contact: your name, phone and email (`webpittas@gmail.com`).
- Version release: **Manually release this version**.
