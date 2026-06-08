import type { lightTheme } from "../styles/theme/themes";
import type { RecursivePartial } from "../types/utils";

export type ThemeWrapperTheme = RecursivePartial<typeof lightTheme>;
