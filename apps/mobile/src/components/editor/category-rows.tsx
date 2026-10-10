import { MAX_CATEGORY, withImplicitCategories, type ActivityTemplate, type Category } from "@klndr/core";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { FieldRow, Picker, RowIcon, TextField } from "@/components/ui";
import { Tag } from "@/icons";

const NEW_CATEGORY = "\u0000new";

/**
 * Which category a block or an activity belongs to: one of the existing ones, or a new one named on the spot.
 * The new one is only made when the form is saved, so `creating` and `newName` are the form's to read.
 */
export function useCategoryChoice(categories: Category[], templates: ActivityTemplate[], initial: string) {
  const [category, setCategory] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const options = useMemo(() => {
    const names = withImplicitCategories(categories, templates).map((entry) => entry.name);
    if (category && !names.some((name) => name.toLowerCase() === category.toLowerCase())) names.push(category);
    return [...names.map((name) => ({ label: name, value: name })), { label: "New category…", value: NEW_CATEGORY }];
  }, [categories, templates, category]);

  return {
    category,
    setCategory,
    creating,
    setCreating,
    newName,
    setNewName,
    options,
    /** The category the form means, trimmed: the new name while one is being typed, otherwise the chosen one. */
    wanted: creating ? newName.trim() : category,
    /** Picks from the menu: "New category…" opens the name field, anything else closes it. */
    choose: (next: string) => {
      if (next === NEW_CATEGORY) return setCreating(true);
      setCreating(false);
      setCategory(next);
    },
    /** A named category was chosen in place of the menu's list (an activity's own category). */
    use: (name: string) => {
      setCreating(false);
      setCategory(name);
    },
    value: creating ? NEW_CATEGORY : category,
  };
}

export type CategoryChoice = ReturnType<typeof useCategoryChoice>;

/**
 * The category row of a form card, and under it the field for a new category's name while one is being made.
 * `last` is true when nothing follows it in the card, so the hairline under it is left out.
 */
export function CategoryRows({ choice, last = true }: { choice: CategoryChoice; last?: boolean }) {
  return (
    <>
      <FieldRow divider={choice.creating || !last} label="Category" leading={<RowIcon icon={Tag} />}>
        <Picker bare label="Category" onChange={choice.choose} options={choice.options} value={choice.value} />
      </FieldRow>
      {choice.creating ? (
        <View className="bg-card px-md pb-xs">
          <TextField
            appearance="bare"
            autoCapitalize="words"
            autoFocus
            label="New category name"
            maxLength={MAX_CATEGORY}
            onChangeText={choice.setNewName}
            placeholder="New category name"
            returnKeyType="done"
            value={choice.newName}
          />
        </View>
      ) : null}
    </>
  );
}
