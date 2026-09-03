import type { RichError } from "../../../services/errors/rich-error";

export const richErrorInterpolationValues = (
  details: RichError["details"]
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(details ?? {}).filter(([field]) => field !== "reason")
  );
