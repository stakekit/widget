import { useEffect } from "react";
import { themes } from "../styles/theme/themes";
import { MaybeDocument } from "../utils/maybe-document";
import { usePrefersColorScheme } from "./use-color-scheme";

export const useToggleTheme = () => {
  const scheme = usePrefersColorScheme();

  useEffect(() => {
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
