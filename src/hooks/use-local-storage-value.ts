import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  LocalStorageKV,
  addLocalStorageListener,
  getStorageItem,
} from "../services/local-storage";

export const useLocalStorageValue = <K extends keyof LocalStorageKV>(
  key: K
) => {
  const [init] = useState(() =>
    getStorageItem(key)
      .mapLeft(() => null)
      .extract()
  );

  const value = useRef(init);

  return useSyncExternalStore(
    useCallback(
      (onChange) => {
        const removeListener = addLocalStorageListener(key, (val) => {
          value.current = val;
          onChange();
        });

        return () => removeListener();
      },
      [key]
    ),
    useCallback(() => value.current, []),
    useCallback(() => null, [])
  );
};
