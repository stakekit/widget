import type { recipe } from "@vanilla-extract/recipes";

export type WidgetVariant = "default" | "finery" | "porto" | "utila" | "zerion";

export const combineRecipeWithVariant = ({
  rec,
  variant = "default",
  state,
  type,
}: {
  rec: ReturnType<typeof recipe>;
  variant: WidgetVariant | undefined;
  state?: string;
  type?: string;
}) => {
  if (rec.classNames.variants.variant?.[variant]) {
    return rec({ variant, state, type });
  }

  return rec();
};
