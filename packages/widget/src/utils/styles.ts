import type { VariantProps } from "@sk-widget/providers/settings/types";
import type { recipe } from "@vanilla-extract/recipes";

export const combineRecipeWithVariant = ({
  rec,
  variant = "default",
  state,
  type,
}: {
  rec: ReturnType<typeof recipe>;
  variant: VariantProps["variant"] | undefined;
  state?: string;
  type?: string;
}) => {
  if (rec.classNames.variants.variant?.[variant]) {
    return rec({ variant, state, type });
  }

  return rec();
};
