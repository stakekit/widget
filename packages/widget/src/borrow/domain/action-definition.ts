import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";

export class ActionDefinition extends Schema.Class<ActionDefinition>(
  "BorrowActionDefinition"
)(BorrowApi.ActionDefinitionDto.fields) {}
