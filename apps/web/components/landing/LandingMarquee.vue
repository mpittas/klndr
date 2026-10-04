<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { paletteOf } from "~/lib/colors";
import { formatDuration } from "@klndr/core";

// What every new account starts with: DEFAULT_TEMPLATES and the daily routines in apps/api/src/db.ts.
const activities = [
  { emoji: "☀️", title: "Morning routine", color: "amber", duration: 45 },
  { emoji: "🛠️", title: "Working on projects", color: "indigo", duration: 120 },
  { emoji: "🏋️", title: "Workout", color: "emerald", duration: 60 },
  { emoji: "📬", title: "Emails & admin", color: "slate", duration: 30 },
  { emoji: "🧹", title: "Cleaning", color: "cyan", duration: 45 },
  { emoji: "📚", title: "Study / learning", color: "rose", duration: 60 },
  { emoji: "🍽️", title: "Meals", color: "orange", duration: 45 },
  { emoji: "👥", title: "Meeting", color: "violet", duration: 60 },
  { emoji: "🚶", title: "Walk outside", color: "lime", duration: 30 },
  { emoji: "🛒", title: "Errands", color: "pink", duration: 60 },
  { emoji: "🧼", title: "Deep clean", color: "teal", duration: 120 },
  { emoji: "🌙", title: "Evening wind-down", color: "sky", duration: 30 },
];

const routines = [
  { emoji: "💊", title: "Take vitamins & pills", done: true },
  { emoji: "🥤", title: "Drink protein shake", done: false },
  { emoji: "🚿", title: "Morning shower", done: false },
  { emoji: "💧", title: "Drink 2L water", done: true },
  { emoji: "🧘", title: "10 min stretch / meditate", done: false },
];

// Each track holds its items twice and slides by half its width, so the loop has no seam.
// The routines row is short, so it repeats once more to stay wider than the screen.
const activityTrack = [...activities, ...activities];
const routineTrack = [...routines, ...routines, ...routines, ...routines];
</script>

<template>
  <section aria-labelledby="library-title" class="relative bg-background pb-20 sm:pb-24">
    <p id="library-title" data-reveal class="mx-auto max-w-md px-5 text-center text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
      Twelve everyday activities and five daily routines are waiting in your library the moment you sign in.
    </p>

    <div data-reveal aria-hidden="true" class="marquee mt-8 space-y-3 [--reveal-delay:120ms]">
      <div class="marquee-track [--duration:70s]">
        <span
          v-for="(item, index) in activityTrack"
          :key="index"
          class="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-3.5 shadow-2xs"
        >
          <span :class="['flex h-8 w-8 items-center justify-center rounded-lg text-sm leading-none', paletteOf(item.color).icon]">
            {{ item.emoji }}
          </span>
          <span class="text-sm font-medium text-foreground">{{ item.title }}</span>
          <span class="font-mono text-xs tabular-nums text-muted-foreground">{{ formatDuration(item.duration) }}</span>
        </span>
      </div>

      <div class="marquee-track reverse [--duration:60s]">
        <span
          v-for="(routine, index) in routineTrack"
          :key="index"
          :class="[
            'inline-flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-2 pr-3.5 text-sm font-medium shadow-2xs',
            routine.done ? 'border-border/60 bg-muted/60 text-muted-foreground line-through' : 'border-border bg-card text-foreground',
          ]"
        >
          <span
            :class="[
              'flex h-4 w-4 items-center justify-center rounded-full border',
              routine.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/40 text-transparent',
            ]"
          >
            <Check class="h-2.5 w-2.5" :stroke-width="3" />
          </span>
          {{ routine.emoji }} {{ routine.title }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.marquee {
  overflow: hidden;
  padding-block: 2px;
  mask-image: linear-gradient(to right, transparent, black 14%, black 86%, transparent);
}

.marquee-track {
  --gap: 0.75rem;
  display: flex;
  width: max-content;
  gap: var(--gap);
  animation: marquee var(--duration, 60s) linear infinite;
}
.marquee-track.reverse {
  animation-direction: reverse;
}
.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee {
  to {
    transform: translateX(calc(-50% - var(--gap) / 2));
  }
}
</style>
