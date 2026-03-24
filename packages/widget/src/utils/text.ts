import { memoize } from "./memoize";

export const capitalizeFirstLowerRest = memoize(
  (txt: string) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
);
