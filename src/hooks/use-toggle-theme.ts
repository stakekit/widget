import { useLayoutEffect } from "react";
import { themes } from "../styles";
import { usePrefersColorScheme } from "./use-color-scheme";
import { MaybeDocument } from "../utils/maybe-document";

export const useToggleTheme = () => {
  const scheme = usePrefersColorScheme();

  useLayoutEffect(() => {
    if (scheme === "dark") {
      MaybeDocument.ifJust((doc) => {
        doc.body.classList.remove(themes.light);
        doc.body.classList.remove(themes.lightOverrides);
        doc.body.classList.add(themes.dark);
        doc.body.classList.add(themes.darkOverrides);
      });
    } else {
      MaybeDocument.ifJust((doc) => {
        doc.body.classList.add(themes.light);
        doc.body.classList.add(themes.lightOverrides);
        doc.body.classList.remove(themes.dark);
        doc.body.classList.remove(themes.darkOverrides);
      });
    }
  }, [scheme]);
};
