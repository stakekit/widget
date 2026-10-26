import { useState, useSyncExternalStore } from "react";
import { SKApp, type SKAppProps } from "../src/index.package";
import type { ConnectionSettings } from "./connection-settings";
import { PlaygroundPanel } from "./panel";
import type { PlaygroundConfig } from "./playground-config";
import type { PlaygroundWallet } from "./wallet/playground-wallet";

/** The widget on the playground host wallet; account and chain changes rerender, never remount. */
const HostWalletWidget = ({
  props,
  wallet,
}: {
  readonly props: SKAppProps;
  readonly wallet: PlaygroundWallet;
}) => {
  const { connection } = useSyncExternalStore(
    wallet.subscribe,
    wallet.getState
  );

  return (
    <SKApp
      {...props}
      externalProviders={{
        type: "generic",
        provider: wallet.provider,
        currentAddress: connection.address,
        ...(connection.chainId !== undefined && {
          currentChain: connection.chainId,
        }),
      }}
    />
  );
};

const Widget = ({
  props,
  startError,
  wallet,
}: {
  readonly props: SKAppProps;
  readonly startError: string | undefined;
  readonly wallet: PlaygroundWallet | undefined;
}) => {
  if (startError !== undefined) {
    return (
      <p className="pg-start-error">
        The playground could not start: {startError}. Change the setup in the
        panel or reset it to the defaults.
      </p>
    );
  }
  return wallet ? (
    <HostWalletWidget props={props} wallet={wallet} />
  ) : (
    <SKApp {...props} />
  );
};

export const PlaygroundApp = ({
  config,
  connection,
  props,
  startError,
  wallet,
}: {
  readonly config: PlaygroundConfig;
  readonly connection: ConnectionSettings;
  readonly props: SKAppProps;
  readonly startError?: string;
  readonly wallet: PlaygroundWallet | undefined;
}) => {
  const [panelOpen, setPanelOpen] = useState(startError !== undefined);

  return (
    <>
      <div className="pg-toolbar">
        <span className="pg-badge">wallet: {config.wallet}</span>
        <button
          className="pg-primary"
          onClick={() => setPanelOpen(!panelOpen)}
          type="button"
        >
          Playground
        </button>
      </div>
      {panelOpen && (
        <PlaygroundPanel
          config={config}
          connection={connection}
          onClose={() => setPanelOpen(false)}
          wallet={wallet}
        />
      )}
      <Widget props={props} startError={startError} wallet={wallet} />
    </>
  );
};
