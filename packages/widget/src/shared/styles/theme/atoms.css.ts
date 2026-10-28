import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";
import { Record as ERecord } from "effect";
import { breakpoints, minMediaQuery } from "../tokens/breakpoints";
import { responsiveProperties, unresponsiveProperties } from "./properties";

const unresponsiveAtomicProperties = defineProperties({
  properties: unresponsiveProperties,
});

const responsiveAtomicProperties = defineProperties({
  conditions: ERecord.map(
    breakpoints,
    (_, breakpoint): { "@media"?: string } =>
      breakpoint === "mobile" ? {} : { "@media": minMediaQuery(breakpoint) }
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
