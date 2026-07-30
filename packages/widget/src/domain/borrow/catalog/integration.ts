import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { IntegrationId } from "../ids";
import { ActionDefinition } from "./action-definition";

export const Integration = Schema.Struct({
  ...BorrowApi.IntegrationDto.fields,
  actions: Schema.Array(ActionDefinition),
  id: IntegrationId,
});
export type Integration = typeof Integration.Type;
