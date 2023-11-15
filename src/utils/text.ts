import { memoize } from "./memoize";

export const removeUnderscores = memoize((txt: string) =>
  txt.replace(/_/g, " ")
);

export const capitalizeFirstLowerRest = memoize(
  (txt: string) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
);
