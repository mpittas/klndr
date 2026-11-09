import { searchEmojis, type EmojiEntry, type EmojiGroup } from "@klndr/core";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, useWindowDimensions, View } from "react-native";

import { SearchField, SheetHeader, Skeleton, Text } from "@/components/ui";
import { answerEmoji, loadEmojiGroups, recentEmojis, rememberRecentEmoji } from "@/lib/emoji";

const CELL = 48;
const SIDE = 16;

type Row =
  | { kind: "header"; key: string; title: string }
  | { kind: "emojis"; key: string; emojis: EmojiEntry[] };

/** Splits a list of emojis into rows that fill the width, under an optional heading. */
function rowsOf(title: string | null, emojis: EmojiEntry[], perRow: number, key: string): Row[] {
  const rows: Row[] = title ? [{ kind: "header", key: `${key}-title`, title }] : [];
  for (let at = 0; at < emojis.length; at += perRow) {
    rows.push({ kind: "emojis", key: `${key}-${at}`, emojis: emojis.slice(at, at + perRow) });
  }
  return rows;
}

const EmojiRow = memo(function EmojiRow({ emojis, onPick }: { emojis: EmojiEntry[]; onPick: (char: string) => void }) {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: SIDE }}>
      {emojis.map((emoji) => (
        <Pressable
          accessibilityLabel={emoji.label}
          accessibilityRole="button"
          key={emoji.char}
          onPress={() => onPick(emoji.char)}
          style={({ pressed }) => ({ width: CELL, height: CELL, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={{ fontSize: 28, lineHeight: 34 }}>{emoji.char}</Text>
        </Pressable>
      ))}
    </View>
  );
});

/** Choose an emoji: search, the ones used lately, then every group. The choice goes back to the screen that asked. */
export default function EmojiSheet() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const perRow = Math.max(4, Math.floor((width - SIDE * 2) / CELL));

  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [query, setQuery] = useState("");
  const [recent] = useState(recentEmojis);

  useEffect(() => {
    let live = true;
    void loadEmojiGroups().then((loaded) => live && setGroups(loaded));
    return () => {
      live = false;
    };
  }, []);

  const pick = useCallback(
    (char: string) => {
      rememberRecentEmoji(char);
      answerEmoji(char);
      router.back();
    },
    [router],
  );

  const rows = useMemo<Row[]>(() => {
    if (!groups) return [];
    if (query.trim()) return rowsOf(null, searchEmojis(groups, query), perRow, "found");
    const known = new Map(groups.flatMap((group) => group.emojis.map((emoji) => [emoji.char, emoji] as const)));
    const lately = recent.map((char) => known.get(char)).filter((emoji): emoji is EmojiEntry => Boolean(emoji));
    return [
      ...(lately.length ? rowsOf("Recent", lately, perRow, "recent") : []),
      ...groups.flatMap((group) => rowsOf(group.label, group.emojis, perRow, group.key)),
    ];
  }, [groups, query, recent, perRow]);

  return (
    <View className="flex-1 bg-background">
      <SheetHeader onClose={() => router.back()} title="Choose an emoji" />
      <View className="px-md pb-sm">
        <SearchField label="Search emojis" onChangeText={setQuery} placeholder="Search, e.g. coffee, run, book" surface="muted" value={query} />
      </View>

      {groups ? (
        <FlatList
          data={rows}
          initialNumToRender={14}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(row) => row.key}
          ListEmptyComponent={
            <Text className="px-md py-lg text-center" tone="muted">
              No emoji matches “{query.trim()}”.
            </Text>
          }
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <Text accessibilityRole="header" className="px-md pb-xs pt-md" tone="muted" variant="caption" weight={600}>
                {item.title}
              </Text>
            ) : (
              <EmojiRow emojis={item.emojis} onPick={pick} />
            )
          }
          windowSize={9}
        />
      ) : (
        <View className="gap-sm px-md pt-md">
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </View>
      )}
    </View>
  );
}
