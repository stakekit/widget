import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";
import type { Breakpoint } from "../tokens/breakpoints";
import { breakpoints, minMediaQuery } from "../tokens/breakpoints";
import { responsiveProperties, unresponsiveProperties } from "./properties";

const unresponsiveAtomicProperties = defineProperties({
  properties: unresponsiveProperties,
});

const responsiveAtomicProperties = defineProperties({
  conditions: Object.keys(breakpoints).reduce(
    (acc, key) => {
      const k = key as Breakpoint;

      if (k === "mobile") {
        acc[k] = {};
      } else {
        acc[k] = { "@media": minMediaQuery(k) };
      }

      return acc;
    },
    {} as { [Key in Breakpoint]: { "@media"?: string } }
  ),

  defaultCondition: "mobile",
  properties: responsiveProperties,
  shorthands: {
    px: ["paddingLeft", "paddingRight"],
    py: ["paddingTop", "paddingBottom"],
    mx: ["marginLeft", "marginRight"],
    my: ["marginTop", "marginBottom"],
    hw: ["height", "width"],
  },
});

export const atoms = createSprinkles(
  unresponsiveAtomicProperties,
  responsiveAtomicProperties
);

export type Atoms = Parameters<typeof atoms>[0];
