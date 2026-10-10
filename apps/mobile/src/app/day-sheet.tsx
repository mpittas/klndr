import { isValidISODate, longDate, todayISO } from "@klndr/core";
import { useChecklist, useNotesEditor } from "@klndr/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { ChecklistPanel } from "@/components/checklist/checklist-panel";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Button, EmptyState, SegmentedControl, SheetHeader, Skeleton } from "@/components/ui";

type Tab = "checklist" | "notes";

/**
 * A day's routines and notes in one sheet (`?day=…&tab=checklist|notes`), opened from the Day tab's shelf. The
 * two hooks live here, not in the panels, so each has exactly one owner while the sheet is open: one saver
 * for the notes, one view of the checklist.
 */
export default function DaySheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; tab?: string }>();
  const day = isValidISODate(params.day) ? params.day : todayISO();
  const [tab, setTab] = useState<Tab>(params.tab === "notes" ? "notes" : "checklist");
  const checklist = useChecklist(day);
  const notes = useNotesEditor(day);

  return (
    <View className="flex-1 bg-canvas">
      <SheetHeader onClose={() => router.back()} subtitle={longDate(day)} title={tab === "notes" ? "Notes" : "Routines"} />
      <View className="px-md pb-sm">
        <SegmentedControl
          label="What to show"
          onChange={setTab}
          options={[
            { label: "Routines", value: "checklist" },
            { label: "Notes", value: "notes" },
          ]}
          value={tab}
        />
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {tab === "notes" ? (
          <NotesPanel notes={notes} />
        ) : checklist.isLoading ? (
          <View className="gap-sm">
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
          </View>
        ) : checklist.isError && !checklist.hasChecklist ? (
          <EmptyState
            action={<Button label="Try again" onPress={() => void checklist.refetch()} variant="surface" />}
            description="Check your connection and try again."
            title="Could not load the routines"
          />
        ) : (
          <ChecklistPanel checklist={checklist} />
        )}
      </ScrollView>
    </View>
  );
}
