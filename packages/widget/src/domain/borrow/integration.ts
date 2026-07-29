import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { ActionDefinition } from "./action-definition";
import { IntegrationId } from "./ids";

export const Integration = Schema.Struct({
  ...BorrowApi.IntegrationDto.fields,
  actions: Schema.Array(ActionDefinition),
  id: IntegrationId,
});
export type Integration = typeof Integration.Type;
