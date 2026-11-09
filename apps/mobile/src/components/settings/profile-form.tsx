import { DURATION_OPTIONS, PROFILE_LIMITS, formatDuration, type UserProfile } from "@klndr/core";
import { useUpdateProfile } from "@klndr/data";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, FieldRow, Picker, Section, Switch, Text, TextField, useToast } from "@/components/ui";
import { useThemeColors } from "@/theme/tokens";

type Form = {
  displayName: string;
  phone: string;
  location: string;
  bio: string;
  timezone: string;
  weekStartsOnMonday: boolean;
  defaultTaskDuration: number;
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const formOf = (profile: UserProfile): Form => ({
  displayName: profile.displayName || "",
  phone: profile.phone || "",
  location: profile.location || "",
  bio: profile.bio || "",
  timezone: profile.timezone || deviceTimeZone(),
  weekStartsOnMonday: profile.weekStartsOnMonday ?? true,
  defaultTaskDuration: profile.defaultTaskDuration ?? 60,
});

const sameForm = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((key) => a[key] === b[key]);

const DURATION_CHOICES = DURATION_OPTIONS.map((minutes) => ({ label: formatDuration(minutes), value: minutes }));

/** The label column, so the fields of a card line up. */
const LABEL_WIDTH = 92;

/**
 * The profile as the web's profile page edits it, as two grouped cards: who you are, and how the planner behaves for
 * you (the time zone, the length a new block starts with, which day the week begins on). One Save for all of it,
 * which `useUpdateProfile` checks, shows at once and puts back if saving fails; it appears once something changed.
 */
export function ProfileForm({ profile, email }: { profile: UserProfile; email: string | null }) {
  const toast = useToast();
  const colors = useThemeColors();
  const update = useUpdateProfile();

  const saved = useMemo(() => formOf(profile), [profile]);
  const [form, setForm] = useState<Form>(saved);
  // The profile the form was last filled from. When a different one arrives (the first load, or a save
  // coming back), the form follows it.
  const [filledFrom, setFilledFrom] = useState(profile);
  if (profile !== filledFrom) {
    setFilledFrom(profile);
    setForm(formOf(profile));
  }

  const [error, setError] = useState<string | null>(null);
  const dirty = !sameForm(form, saved);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        displayName: form.displayName,
        phone: form.phone,
        location: form.location,
        bio: form.bio,
        timezone: form.timezone,
        weekStartsOnMonday: form.weekStartsOnMonday,
        defaultTaskDuration: form.defaultTaskDuration,
      });
      toast.show({ message: "Profile saved" });
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : "Could not save your profile.");
    }
  };

  const durationOptions = useMemo(
    () =>
      DURATION_CHOICES.some((choice) => choice.value === form.defaultTaskDuration)
        ? DURATION_CHOICES
        : [...DURATION_CHOICES, { label: formatDuration(form.defaultTaskDuration), value: form.defaultTaskDuration }],
    [form.defaultTaskDuration],
  );

  const field = { appearance: "bare" as const, className: "w-full" };

  return (
    <>
      <Section title="Profile">
        <FieldRow label="Name" labelWidth={LABEL_WIDTH}>
          <TextField
            {...field}
            autoCapitalize="words"
            autoComplete="name"
            label="Display name"
            maxLength={PROFILE_LIMITS.displayName}
            onChangeText={(value) => set("displayName", value)}
            placeholder="Your full name"
            textContentType="name"
            value={form.displayName}
          />
        </FieldRow>
        {email ? (
          <FieldRow label="Email" labelWidth={LABEL_WIDTH}>
            <Text accessibilityLabel={`Account email, ${email}`} numberOfLines={1} tone="muted" variant="callout">
              {email}
            </Text>
          </FieldRow>
        ) : null}
        <FieldRow label="Phone" labelWidth={LABEL_WIDTH}>
          <TextField
            {...field}
            autoComplete="tel"
            keyboardType="phone-pad"
            label="Phone number"
            maxLength={PROFILE_LIMITS.phone}
            onChangeText={(value) => set("phone", value)}
            placeholder="Optional"
            textContentType="telephoneNumber"
            value={form.phone}
          />
        </FieldRow>
        <FieldRow label="Location" labelWidth={LABEL_WIDTH}>
          <TextField
            {...field}
            autoCapitalize="words"
            label="Location"
            maxLength={PROFILE_LIMITS.location}
            onChangeText={(value) => set("location", value)}
            placeholder="City, Country"
            value={form.location}
          />
        </FieldRow>
        <View className="px-md pt-sm">
          <Text variant="callout">Bio</Text>
          <TextField
            appearance="bare"
            autoCapitalize="sentences"
            label="Bio / notes"
            maxLength={PROFILE_LIMITS.bio}
            multiline
            onChangeText={(value) => set("bio", value)}
            placeholder="Your scheduling goals, a note to yourself…"
            value={form.bio}
          />
        </View>
      </Section>

      <Section
        footer={form.timezone !== deviceTimeZone() ? undefined : "The time zone is a name like Europe/Nicosia or America/New_York."}
        title="Planner"
      >
        <FieldRow label="Time zone" labelWidth={LABEL_WIDTH}>
          <TextField
            {...field}
            autoCapitalize="none"
            autoCorrect={false}
            label="Time zone"
            maxLength={PROFILE_LIMITS.timezone}
            onChangeText={(value) => set("timezone", value)}
            value={form.timezone}
          />
        </FieldRow>
        {form.timezone !== deviceTimeZone() ? (
          <Pressable
            accessibilityRole="button"
            className="justify-center px-md"
            onPress={() => set("timezone", deviceTimeZone())}
            style={({ pressed }) => ({
              minHeight: 44,
              opacity: pressed ? 0.6 : 1,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            })}
          >
            <Text variant="callout" weight={600}>
              Use this phone’s time zone ({deviceTimeZone()})
            </Text>
          </Pressable>
        ) : null}
        <FieldRow label="New blocks last">
          <Picker
            bare
            label="Default block duration"
            onChange={(minutes) => set("defaultTaskDuration", minutes)}
            options={durationOptions}
            value={form.defaultTaskDuration}
          />
        </FieldRow>
        <FieldRow divider={false} label="Week starts on Monday">
          <Switch
            bare
            helper="Used by the calendar's weeks."
            label="Week starts on Monday"
            onValueChange={(value) => set("weekStartsOnMonday", value)}
            value={form.weekStartsOnMonday}
          />
        </FieldRow>
      </Section>

      {dirty || error ? (
        <View className="gap-sm">
          {error ? (
            <Text accessibilityLiveRegion="polite" className="px-md" tone="destructive" variant="caption">
              {error}
            </Text>
          ) : null}
          <View className="flex-row gap-sm">
            <Button className="flex-1" label="Discard" onPress={() => setForm(saved)} size="large" variant="surface" />
            <Button className="flex-[1.6]" disabled={!dirty} label="Save changes" loading={update.isPending} onPress={() => void save()} size="large" />
          </View>
        </View>
      ) : null}
    </>
  );
}
