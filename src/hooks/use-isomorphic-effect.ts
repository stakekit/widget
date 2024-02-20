import { useEffect, useLayoutEffect } from "react";
import { MaybeWindow } from "../utils/maybe-window";

export const useIsomorphicEffect = MaybeWindow.map(
  () => useLayoutEffect
).orDefault(useEffect);
