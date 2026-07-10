import {
  BigIntFromString as AppBigIntFromString,
  FiniteNumberFromString,
} from "../../domain/schema/scalars";

export const NumberFromString = FiniteNumberFromString;
export type NumberFromString = typeof NumberFromString.Type;

export const BigIntFromString = AppBigIntFromString;
export type BigIntFromString = typeof BigIntFromString.Type;
