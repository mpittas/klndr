/**
 * The icons the app draws, imported one file at a time.
 *
 * `lucide-react-native`'s barrel export pulls every one of its ~1800 icons into the bundle, because
 * Metro does not tree-shake: it took the Android bundle from ~3 MB to 6.6 MB. Importing the single
 * file (`lucide-react-native/icons/<name>`) keeps only the icons actually used, and gives one place
 * to see what the app draws. DESIGN.md asks for drawn SVG icons with a consistent stroke, never
 * emoji.
 *
 * Keep this list alphabetical, and only add an icon that is genuinely used somewhere. The file names
 * are lucide's kebab-case icon names, which are not always the component name (there is no `trash-2`
 * any more: `Trash2` is an alias of `Trash`).
 */
export { default as ArrowUpRight } from "lucide-react-native/icons/arrow-up-right";
export { default as CalendarDays } from "lucide-react-native/icons/calendar-days";
export { default as CalendarX } from "lucide-react-native/icons/calendar-x";
export { default as Check } from "lucide-react-native/icons/check";
export { default as ChevronDown } from "lucide-react-native/icons/chevron-down";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as CircleCheck } from "lucide-react-native/icons/circle-check";
export { default as Clock } from "lucide-react-native/icons/clock";
export { default as Ellipsis } from "lucide-react-native/icons/ellipsis";
export { default as ExternalLink } from "lucide-react-native/icons/external-link";
export { default as FolderPlus } from "lucide-react-native/icons/folder-plus";
export { default as Hourglass } from "lucide-react-native/icons/hourglass";
export { default as KeyRound } from "lucide-react-native/icons/key-round";
export { default as ListChecks } from "lucide-react-native/icons/list-checks";
export { default as LogOut } from "lucide-react-native/icons/log-out";
export { default as NotebookPen } from "lucide-react-native/icons/notebook-pen";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as Redo2 } from "lucide-react-native/icons/redo-2";
export { default as Search } from "lucide-react-native/icons/search";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";
export { default as Tag } from "lucide-react-native/icons/tag";
export { default as Trash } from "lucide-react-native/icons/trash";
export { default as Undo2 } from "lucide-react-native/icons/undo-2";
export { default as X } from "lucide-react-native/icons/x";
