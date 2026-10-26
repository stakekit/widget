import { Option } from "effect";
import { useState, useSyncExternalStore } from "react";
import { DashboardYieldCategory, YieldProviderId } from "../src/index.package";
import {
  type ConnectionSettings,
  connectionProps,
  saveConnectionSettings,
} from "./connection-settings";
import {
  decodeExtraProps,
  defaultPlaygroundConfig,
  hostVariants,
  languages,
  type PlaygroundConfig,
  themes,
  walletModes,
  writePlaygroundConfig,
} from "./playground-config";
import type { PlaygroundWallet } from "./wallet/playground-wallet";

const categories = Object.values(DashboardYieldCategory);
const knownProviderIds = Object.values(YieldProviderId).join(", ");

const connectionFields = [
  { key: "apiKey", label: "API key", env: "VITE_API_KEY" },
  { key: "apiUrl", label: "API URL", env: "VITE_API_URL" },
  { key: "yieldsApiUrl", label: "Yields API URL", env: "VITE_YIELDS_API_URL" },
  { key: "borrowApiUrl", label: "Borrow API URL", env: "VITE_BORROW_API_URL" },
] as const;

const Choice = <Value extends string>({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: ReadonlyArray<Value>;
  readonly value: Value;
}) => (
  <label className="pg-field">
    <span>{label}</span>
    <select
      onChange={(event) => {
        const next = options.find((option) => option === event.target.value);
        if (next !== undefined) onChange(next);
      }}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

const Toggle = ({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) => (
  <label className="pg-toggle">
    <input
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      type="checkbox"
    />
    <span>{label}</span>
  </label>
);

const TextField = ({
  label,
  onChange,
  placeholder,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
}) => (
  <label className="pg-field">
    <span>{label}</span>
    <input
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  </label>
);

const linkFor = (config: PlaygroundConfig) =>
  writePlaygroundConfig(window.location.search, config);

/** Navigates to a config link; the page reloads and mounts the widget with it. */
const navigateTo = (search: string) => {
  if (search === window.location.search) {
    window.location.reload();
    return;
  }
  window.location.search = search;
};

const WalletPanel = ({ wallet }: { readonly wallet: PlaygroundWallet }) => {
  const { connection, defaultOutcome, held, queue } = useSyncExternalStore(
    wallet.subscribe,
    wallet.getState
  );
  const [address, setAddress] = useState(connection.address);
  const { controls } = wallet;

  return (
    <section className="pg-section">
      <h3>Host wallet (live)</h3>
      <p className="pg-status">
        account{" "}
        {connection.address === "" ? "disconnected" : connection.address}
        <br />
        chain {connection.chainId ?? "unknown"} · default {defaultOutcome} ·
        queued {queue.length === 0 ? "none" : queue.join(", ")} · held{" "}
        {held.length === 0 ? "none" : held.join(", ")}
      </p>
      <div className="pg-buttons">
        <button onClick={() => controls.next("hold")} type="button">
          Hold next
        </button>
        <button onClick={() => controls.next("errorWithHash")} type="button">
          Error + hash next
        </button>
        <button onClick={() => controls.next("cancelled")} type="button">
          Cancel next
        </button>
        <button
          disabled={held.length === 0}
          onClick={() => controls.release()}
          type="button"
        >
          Release held
        </button>
        <button onClick={() => controls.reset()} type="button">
          Reset outcomes
        </button>
      </div>
      <TextField label="Account" onChange={setAddress} value={address} />
      <div className="pg-buttons">
        <button onClick={() => controls.setAddress(address)} type="button">
          Set account
        </button>
        <button onClick={() => controls.disconnect()} type="button">
          Disconnect
        </button>
      </div>
      <p className="pg-hint">
        More in the console: <code>skDev.wallet.help()</code>
      </p>
    </section>
  );
};

export const PlaygroundPanel = ({
  config,
  connection,
  onClose,
  wallet,
}: {
  readonly config: PlaygroundConfig;
  readonly connection: ConnectionSettings;
  readonly onClose: () => void;
  readonly wallet: PlaygroundWallet | undefined;
}) => {
  const [draft, setDraft] = useState(config);
  const [connectionDraft, setConnectionDraft] = useState(connection);
  const [providerOrder, setProviderOrder] = useState(() =>
    Object.fromEntries(
      categories.map((category) => [
        category,
        (config.yieldProviderOrder[category] ?? []).join(", "),
      ])
    )
  );
  const [extraProps, setExtraProps] = useState(() =>
    Object.keys(config.extraProps).length === 0
      ? ""
      : JSON.stringify(config.extraProps, null, 2)
  );
  const [error, setError] = useState<string>();

  const update = <Key extends keyof PlaygroundConfig>(
    key: Key,
    value: PlaygroundConfig[Key]
  ) => setDraft({ ...draft, [key]: value });

  const buildConfig = () => {
    const decoded =
      extraProps.trim() === ""
        ? Option.some({})
        : decodeExtraProps(extraProps.trim());
    if (Option.isNone(decoded)) {
      setError("Extra props must be a JSON object");
      return undefined;
    }
    const linkedConnection = connectionProps.filter(
      (prop) => prop in decoded.value
    );
    if (linkedConnection.length > 0) {
      setError(
        `Set ${linkedConnection.join(", ")} under Connection: links are shared`
      );
      return undefined;
    }
    setError(undefined);
    const yieldProviderOrder = Object.fromEntries(
      categories.flatMap((category) => {
        const ids = (providerOrder[category] ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== "");
        return ids.length === 0 ? [] : [[category, ids]];
      })
    );
    return { ...draft, yieldProviderOrder, extraProps: decoded.value };
  };

  const apply = () => {
    const next = buildConfig();
    if (next === undefined) return;
    saveConnectionSettings(connectionDraft);
    navigateTo(linkFor(next));
  };

  const copyLink = async () => {
    const next = buildConfig();
    if (next === undefined) return;
    const { origin, pathname } = window.location;
    await navigator.clipboard.writeText(`${origin}${pathname}${linkFor(next)}`);
  };

  return (
    <aside className="pg-panel" data-testid="playground-panel">
      <header className="pg-panel-header">
        <h2>Playground</h2>
        <button onClick={onClose} type="button">
          Close
        </button>
      </header>

      {wallet && <WalletPanel wallet={wallet} />}

      <section className="pg-section">
        <h3>Harness</h3>
        <Choice
          label="Wallet"
          onChange={(value) => update("wallet", value)}
          options={walletModes}
          value={draft.wallet}
        />
        {draft.wallet === "scripted" && (
          <TextField
            label="Scripted account"
            onChange={(value) => update("scriptedAddress", value)}
            value={draft.scriptedAddress}
          />
        )}
        <Toggle
          checked={draft.trackingLog}
          label="Log tracking events"
          onChange={(value) => update("trackingLog", value)}
        />
      </section>

      <section className="pg-section">
        <h3>Widget props</h3>
        <Choice
          label="variant"
          onChange={(value) => update("variant", value)}
          options={hostVariants}
          value={draft.variant}
        />
        <Choice
          label="theme"
          onChange={(value) => update("theme", value)}
          options={themes}
          value={draft.theme}
        />
        <Choice
          label="language"
          onChange={(value) => update("language", value)}
          options={languages}
          value={draft.language}
        />
        <Toggle
          checked={draft.dashboardVariant}
          label="dashboardVariant"
          onChange={(value) => update("dashboardVariant", value)}
        />
        <Toggle
          checked={draft.borrowEnabled}
          label="borrowEnabled"
          onChange={(value) => update("borrowEnabled", value)}
        />
        <Toggle
          checked={draft.hideGasFee}
          label="hideGasFee"
          onChange={(value) => update("hideGasFee", value)}
        />
        <fieldset className="pg-fieldset">
          <legend>yieldProviderOrder (comma-separated provider IDs)</legend>
          {categories.map((category) => (
            <TextField
              key={category}
              label={category}
              onChange={(value) =>
                setProviderOrder({ ...providerOrder, [category]: value })
              }
              placeholder="e.g. benqi, lido"
              value={providerOrder[category] ?? ""}
            />
          ))}
          <details>
            <summary>Known provider IDs</summary>
            <p className="pg-hint">{knownProviderIds}</p>
          </details>
        </fieldset>
        <label className="pg-field">
          <span>Extra props (JSON object, merged last)</span>
          <textarea
            onChange={(event) => setExtraProps(event.target.value)}
            placeholder='{ "hideNetworkLogo": true }'
            rows={4}
            value={extraProps}
          />
        </label>
      </section>

      <section className="pg-section">
        <h3>Connection (this browser only)</h3>
        {connectionFields.map(({ env, key, label }) => (
          <TextField
            key={key}
            label={label}
            onChange={(value) =>
              setConnectionDraft({ ...connectionDraft, [key]: value })
            }
            placeholder={env}
            value={connectionDraft[key]}
          />
        ))}
        <p className="pg-hint">Stored in localStorage, never in the link.</p>
      </section>

      {error && <p className="pg-error">{error}</p>}
      <footer className="pg-buttons">
        <button className="pg-primary" onClick={apply} type="button">
          Apply and reload
        </button>
        <button onClick={copyLink} type="button">
          Copy link
        </button>
        <button
          onClick={() => navigateTo(linkFor(defaultPlaygroundConfig))}
          type="button"
        >
          Reset to defaults
        </button>
      </footer>
    </aside>
  );
};
