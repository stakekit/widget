import type { recipe } from "@vanilla-extract/recipes";
import type { VariantProps } from "../providers/settings/types";

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
