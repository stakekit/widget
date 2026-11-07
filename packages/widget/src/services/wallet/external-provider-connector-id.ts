import type { Connector } from "wagmi";

/** The id of the connector through which the host's External Provider signs. */
export const externalProviderConnectorId = "externalProviderConnector";

/**
 * Whether the connector is the host's External Provider: the host signs for
 * the user, so it names no wallet the user picked.
 */
export const isHostExternalProvider = (connector: Pick<Connector, "id">) =>
  connector.id === externalProviderConnectorId;
