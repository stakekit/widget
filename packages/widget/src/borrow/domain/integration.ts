import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { ActionDefinition } from "./action-definition";
import { IntegrationId } from "./ids";

export class Integration extends Schema.Class<Integration>("BorrowIntegration")(
  {
    ...BorrowApi.IntegrationDto.fields,
    id: IntegrationId,
    actions: Schema.Array(ActionDefinition),
  }
) {}
