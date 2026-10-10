import { listItemDepth, parseInline, parseMarkdown, type InlineSpan, type MarkdownBlock } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { memo, useMemo } from "react";
import { Linking, Platform, Pressable, Text as RNText, View } from "react-native";

import { Text } from "@/components/ui";
import { FONT_FOR_WEIGHT } from "@/fonts";
import { Check } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
/** Headings: the first two levels use the type scale's big steps; the rest are semibold body text. */
const headingVariant = (level: number): "display" | "title" | "body" => (level === 1 ? "display" : level === 2 ? "title" : "body");

/** Only http(s) and mailto links are ever kept by `parseInline`; this is the last check before leaving the app. */
const open = (href: string) => {
  if (/^(https?:\/\/|mailto:)/i.test(href)) void Linking.openURL(href).catch(() => {});
};

/** One line of inline markup as nested text: bold, italic, strikethrough, code and tappable links. */
function Inline({ text }: { text: string }) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const link = PALETTE.indigo[scheme].accent.background ?? colors.foreground;
  const spans = useMemo(() => parseInline(text), [text]);

  return (
    <>
      {spans.map((span: InlineSpan, index) => (
        <RNText
          accessibilityRole={span.href ? "link" : undefined}
          key={index}
          onPress={span.href ? () => open(span.href as string) : undefined}
          style={{
            ...(span.bold ? { fontFamily: FONT_FOR_WEIGHT[700] } : null),
            ...(span.italic ? { fontStyle: "italic" as const } : null),
            ...(span.code ? { fontFamily: MONO, backgroundColor: colors.muted } : null),
            ...(span.href ? { color: link, textDecorationLine: "underline" as const } : null),
            ...(span.strike ? { textDecorationLine: "line-through" as const, color: colors["muted-foreground"] } : null),
          }}
        >
          {span.text}
        </RNText>
      ))}
    </>
  );
}

const Lines = ({ lines }: { lines: string[] }) => (
  <>
    {lines.map((line, index) => (
      <RNText key={index}>
        {index > 0 ? "\n" : ""}
        <Inline text={line} />
      </RNText>
    ))}
  </>
);

function Block({ block, onToggleTask }: { block: MarkdownBlock; onToggleTask: (line: number) => void }) {
  const colors = useThemeColors();

  switch (block.type) {
    case "paragraph":
      return (
        <Text>
          <Lines lines={block.lines} />
        </Text>
      );
    case "heading": {
      const variant = headingVariant(block.level);
      return (
        <Text accessibilityRole="header" style={variant === "body" ? { fontFamily: FONT_FOR_WEIGHT[600] } : undefined} variant={variant}>
          <Inline text={block.text} />
        </Text>
      );
    }
    case "rule":
      return <View className="my-xs h-px bg-border" />;
    case "quote":
      return (
        <View className="border-l-2 border-border pl-md">
          <Text tone="muted">
            <Lines lines={block.lines} />
          </Text>
        </View>
      );
    case "code":
      return (
        <View className="rounded-md bg-muted p-sm">
          <Text selectable style={{ fontFamily: MONO, fontSize: 13 }}>
            {block.code}
          </Text>
        </View>
      );
    case "list": {
      let number = 0;
      return (
        <View className="gap-xs">
          {block.items.map((item) => {
            const depth = listItemDepth(item.indent);
            if (!item.task) number += 1;
            return (
              <View className="flex-row items-start gap-sm" key={item.line} style={{ marginLeft: depth * 20 }}>
                {item.task ? (
                  <Pressable
                    accessibilityLabel={`${item.text}, ${item.checked ? "done" : "not done"}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    hitSlop={10}
                    onPress={() => onToggleTask(item.line)}
                    style={{
                      width: 20,
                      height: 20,
                      marginTop: 1,
                      borderRadius: 5,
                      borderWidth: 1.5,
                      borderColor: item.checked ? colors.foreground : colors["muted-foreground"],
                      backgroundColor: item.checked ? colors.foreground : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.checked ? <Check color={colors.background} size={13} strokeWidth={3.5} /> : null}
                  </Pressable>
                ) : (
                  <Text className="w-5 text-center" tone="muted">
                    {block.ordered ? `${number}.` : "•"}
                  </Text>
                )}
                <Text
                  className="flex-1"
                  style={item.task && item.checked ? { textDecorationLine: "line-through" } : undefined}
                  tone={item.task && item.checked ? "muted" : "foreground"}
                >
                  <Inline text={item.text} />
                </Text>
              </View>
            );
          })}
        </View>
      );
    }
  }
}

/**
 * Notes as native views, from the same parser the web renders: headings, lists, quotes, code, links and task
 * checkboxes that tick in place (`onToggleTask` is told the source line to flip, see `toggleTaskLine`).
 */
export const MarkdownView = memo(function MarkdownView({
  source,
  onToggleTask,
}: {
  source: string;
  onToggleTask: (line: number) => void;
}) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <View className="gap-md">
      {blocks.map((block, index) => (
        <Block block={block} key={index} onToggleTask={onToggleTask} />
      ))}
    </View>
  );
});
