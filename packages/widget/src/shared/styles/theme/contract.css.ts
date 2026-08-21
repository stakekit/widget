import { createGlobalThemeContract } from "@vanilla-extract/css";
import { themeContract } from "../../../public-api/theme";

export const vars = createGlobalThemeContract(
  themeContract,
  (_value, path) =>
    `sk-${path
      .join("-")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()}`
);
