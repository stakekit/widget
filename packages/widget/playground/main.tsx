/**
 * Playground: the dev server and preview deployment page (`index.html`). It
 * mounts the widget as a host would, configured from the page link through
 * the settings panel. Not part of the package or bundle builds.
 */
import "./playground.css";
import ReactDOM from "react-dom/client";
import { EvmChainIds } from "../src/index.package";
import { readConnectionSettings } from "./connection-settings";
import { installDevConsole, logWalletEntry } from "./dev-console";
import { PlaygroundApp } from "./playground-app";
import { readPlaygroundConfig } from "./playground-config";
import { connectInjectedWallet } from "./wallet/injected-wallet-backend";
import {
  makePlaygroundWallet,
  type PlaygroundWallet,
} from "./wallet/playground-wallet";
import { makeScriptedWalletBackend } from "./wallet/scripted-wallet-backend";
import { toWidgetProps } from "./widget-props";

const config = readPlaygroundConfig(window.location.search);
const connection = readConnectionSettings();

/** Simulated wallet latency, long enough to see the widget's signing states. */
const scriptedWalletDelayMs = 800;

const startHostWallet = async (): Promise<PlaygroundWallet | undefined> => {
  switch (config.wallet) {
    case "builtin":
      return undefined;
    case "scripted":
      return makePlaygroundWallet({
        backend: makeScriptedWalletBackend({ delayMs: scriptedWalletDelayMs }),
        connection: {
          address: config.scriptedAddress,
          chainId: EvmChainIds.Ethereum,
        },
        log: logWalletEntry,
      });
    case "injected": {
      const injected = await connectInjectedWallet();
      const wallet = makePlaygroundWallet({
        backend: injected.backend,
        connection: injected.connection,
        log: logWalletEntry,
      });
      injected.watch(wallet.controls);
      return wallet;
    }
  }
};

const start = async () => {
  document.body.dataset.theme = config.theme;
  document.body.dataset.variant = config.variant;

  const wallet = await startHostWallet();
  installDevConsole({ config, wallet });
  return wallet;
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
const app = {
  config,
  connection,
  props: toWidgetProps(config, connection),
};

start()
  .then((wallet) => root.render(<PlaygroundApp {...app} wallet={wallet} />))
  .catch((error: unknown) => {
    console.error("[playground] start failed", error);
    // Keep the panel reachable so a broken link can be changed or reset.
    root.render(
      <PlaygroundApp
        {...app}
        startError={error instanceof Error ? error.message : String(error)}
        wallet={undefined}
      />
    );
  });
