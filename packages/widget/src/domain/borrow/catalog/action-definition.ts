import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";

export const ActionDefinition = Schema.Struct(
  BorrowApi.ActionDefinitionDto.fields
);
export type ActionDefinition = typeof ActionDefinition.Type;
