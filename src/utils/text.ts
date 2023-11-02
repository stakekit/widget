import { memoize } from "./memoize";

export const removeUnderscores = memoize((txt: string) =>
  txt.replace(/_/g, " ")
);
