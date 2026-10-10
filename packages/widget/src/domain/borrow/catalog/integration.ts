import { Schema, Struct } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { TolerantArray } from "../../decoding/response-schema";
import { IntegrationId } from "../ids";

// Advertised `actions` are unread, and a network the client does not know only
// removes that network, so new backend capabilities keep the integration.
export const Integration = Schema.Struct({
  ...Struct.omit(BorrowApi.IntegrationDto.fields, ["actions"]),
  id: IntegrationId,
  networks: TolerantArray(BorrowApi.IntegrationDto.fields.networks.value, {
    operation: "borrow-integration-networks",
  }),
});
export type Integration = typeof Integration.Type;
