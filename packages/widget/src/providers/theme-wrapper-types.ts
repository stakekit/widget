import type { darkTheme, lightTheme } from "../styles/theme/themes";
import type { RecursivePartial } from "../types/utils";

export type ThemeWrapperTheme =
  | RecursivePartial<typeof lightTheme>
  | {
      lightMode?: RecursivePartial<typeof lightTheme>;
      darkMode?: RecursivePartial<typeof darkTheme>;
    };
