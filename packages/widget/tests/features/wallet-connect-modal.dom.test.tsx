import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { avalanche } from "viem/chains";
import { SubstrateChainIds } from "../../src/domain/wallet/chain-ids";
import { substrateChainsMap } from "../../src/services/wallet/internal/adapters/substrate/chains";
import { server } from "../mocks/server";
import { describe, expect, it } from "../utils/test-extend.dom";
import { render } from "../utils/test-utils.dom";
import {
  makeWalletConnectPicker,
  type PickerWallet,
  type PickerWalletGroup,
} from "../utils/wallet-connect-picker";

const substrate = {
  id: "substrate",
  chains: [substrateChainsMap.polkadot.wagmiChain],
} as const;

const element = (testId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

const button = (name: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === name
  );

const click = (target: () => HTMLElement | null | undefined) =>
  Effect.promise(() => act(async () => target()?.click()));

const waitFor = (testId: string) =>
  Effect.promise(() =>
    expect.poll(() => element(testId), { timeout: 5_000 }).not.toBeNull()
  );

const renderPicker = Effect.fn("renderPicker")(function* (
  options: Omit<Parameters<typeof makeWalletConnectPicker>[0], "api">
) {
  const picker = yield* makeWalletConnectPicker({ ...options, api: server });
  const app = yield* Effect.acquireRelease(
    Effect.promise(() => render(picker.element)),
    (app) =>
      picker.declinePending.pipe(Effect.andThen(Effect.sync(app.unmount)))
  );
  yield* Effect.promise(() =>
    expect.poll(() => button("Open wallets")).toBeDefined()
  );
  return { ...picker, app } as const;
});

const showPicker = Effect.gen(function* () {
  yield* click(() => button("Open wallets"));
  yield* waitFor("wallet-connect-dialog");
});

const closePicker = Effect.gen(function* () {
  yield* click(() => document.querySelector('button[aria-label="Close"]'));
  yield* Effect.promise(() =>
    expect.poll(() => element("wallet-connect-dialog")).toBeNull()
  );
});

const openPicker = Effect.fn("openPicker")(function* (
  options: Omit<Parameters<typeof makeWalletConnectPicker>[0], "api">
) {
  const picker = yield* renderPicker(options);
  yield* showPicker;
  return picker;
});

/** Test ids of the picker's wallet rows, in display order. */
const walletRows = () =>
  Array.from(
    document.querySelectorAll(
      '[data-testid="wallet-connect-dialog"] [data-testid^="connect-wallet-"]'
    ),
    (row) => row.getAttribute("data-testid")
  );

const pollTagName = (testId: string, tagName: string) =>
  Effect.promise(() =>
    expect.poll(() => element(testId)?.tagName).toBe(tagName)
  );

const walletGroups = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="wallet-connect-dialog"] section[aria-labelledby]'
    ),
    (group) => ({
      name: document.getElementById(group.getAttribute("aria-labelledby") ?? "")
        ?.textContent,
      wallets: Array.from(
        group.querySelectorAll("[data-testid^='connect-wallet-']"),
        (wallet) => wallet.getAttribute("data-testid")
      ),
    })
  );

const singleGroup = (
  ...wallets: ReadonlyArray<PickerWallet>
): ReadonlyArray<PickerWalletGroup> => [{ groupName: "Wallets", wallets }];

describe("wallet connection picker", () => {
  it.effect(
    "keeps a pending wallet's ecosystem while AppKit is presented over the picker",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          groups: singleGroup(
            { id: "metamask" },
            { id: "talisman", family: substrate }
          ),
        });
        yield* waitFor("connect-ecosystem-substrate");
        yield* click(() => element("connect-ecosystem-substrate"));
        yield* click(() => element("connect-wallet-substrate-talisman"));
        expect(yield* picker.calls).toEqual([
          { walletId: "talisman", chainId: undefined },
        ]);
        expect(element("connect-ecosystem-back")).not.toBeNull();
        expect(
          document.querySelector('button[aria-label="Close"]')
        ).not.toBeNull();

        yield* click(() => button("Present AppKit"));
        yield* Effect.promise(() =>
          expect.poll(() => element("wallet-connect-dialog")).toBeNull()
        );

        yield* picker.declinePending;
        yield* click(() => button("Close AppKit"));
        yield* waitFor("connect-wallet-substrate-talisman");
        expect(element("connect-ecosystem-substrate")).toBeNull();
        expect(element("connect-wallet-evm-metamask")).toBeNull();
        yield* click(() => element("connect-ecosystem-back"));
        yield* waitFor("connect-ecosystem-evm");
      })
  );

  it.effect.each([
    {
      name: "an EVM wallet on an enabled EVM chain",
      initialChain: avalanche.id,
      wallet: { id: "metamask" },
      testId: "connect-wallet-evm-metamask",
      chainId: avalanche.id,
    },
    {
      name: "a Substrate wallet on one of its chains",
      initialChain: SubstrateChainIds.Polkadot,
      wallet: { id: "talisman", family: substrate },
      testId: "connect-wallet-substrate-talisman",
      chainId: SubstrateChainIds.Polkadot,
    },
    {
      name: "an EVM wallet when the initial chain belongs to another family",
      initialChain: SubstrateChainIds.Polkadot,
      wallet: { id: "metamask" },
      testId: "connect-wallet-evm-metamask",
      chainId: undefined,
    },
    {
      name: "a Substrate wallet when the initial chain is an EVM chain",
      initialChain: avalanche.id,
      wallet: { id: "talisman", family: substrate },
      testId: "connect-wallet-substrate-talisman",
      chainId: undefined,
    },
  ] satisfies ReadonlyArray<{
    name: string;
    initialChain: number;
    wallet: PickerWallet;
    testId: string;
    chainId: number | undefined;
  }>)(
    "requests the host's initial chain only when supported: $name",
    ({ initialChain, wallet, testId, chainId }) =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          groups: singleGroup(wallet),
          initialChain: initialChain as typeof avalanche.id,
          networks: ["ethereum", "avalanche-c"],
        });
        yield* waitFor(testId);
        yield* click(() => element(testId));

        expect(yield* picker.calls).toEqual([{ walletId: wallet.id, chainId }]);
      })
  );

  it.effect("ignores an initial chain that the project has not enabled", () =>
    Effect.gen(function* () {
      const picker = yield* openPicker({
        groups: singleGroup({ id: "metamask" }),
        initialChain: avalanche.id,
        networks: ["ethereum"],
      });
      yield* waitFor("connect-wallet-evm-metamask");
      yield* click(() => element("connect-wallet-evm-metamask"));

      expect(yield* picker.calls).toEqual([
        { walletId: "metamask", chainId: undefined },
      ]);
    })
  );

  it.effect(
    "keeps the first connection pending when its wallet row is clicked again",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          groups: singleGroup({ id: "metamask" }),
        });
        const pendingSpinner = () =>
          element("wallet-connect-dialog")?.querySelector("h2")
            ?.nextElementSibling ?? null;
        yield* waitFor("connect-wallet-evm-metamask");
        yield* click(() => element("connect-wallet-evm-metamask"));
        yield* Effect.promise(() => expect.poll(pendingSpinner).not.toBeNull());

        yield* click(() => element("connect-wallet-evm-metamask"));
        // Lets an interrupted first attempt reach the wallet again, if it would.
        yield* Effect.sleep("50 millis").pipe(TestClock.withLive);

        expect(yield* picker.calls).toEqual([
          { walletId: "metamask", chainId: undefined },
        ]);
        expect(pendingSpinner()).not.toBeNull();
      })
  );

  it.effect.each(["desktop", "mobile"] as const)(
    "offers remote wallets for connection on %s",
    (device) =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          device,
          groups: singleGroup({ id: "walletconnect" }),
        });
        yield* waitFor("connect-wallet-evm-walletconnect");
        yield* click(() => element("connect-wallet-evm-walletconnect"));

        expect(yield* picker.calls).toEqual([
          { walletId: "walletconnect", chainId: undefined },
        ]);
      })
  );

  it.effect(
    "lists detected extensions first under Installed, then catalogue groups in order",
    () =>
      Effect.gen(function* () {
        yield* openPicker({
          announcedWallets: ["discovered"],
          extensions: ["keplr-like"],
          groups: [
            { groupName: "Primary", wallets: [{ id: "primary-wallet" }] },
            {
              groupName: "Other",
              wallets: [
                { id: "other-wallet" },
                { id: "keplr-like", injected: {} },
              ],
            },
          ],
        });
        yield* waitFor("connect-wallet-evm-test.discovered");

        // Discovery announces asynchronously; wait for the settled grouping.
        yield* Effect.promise(() =>
          expect.poll(walletGroups).toEqual([
            {
              name: "Installed",
              wallets: [
                "connect-wallet-evm-keplr-like",
                "connect-wallet-evm-test.discovered",
              ],
            },
            {
              name: "Primary",
              wallets: ["connect-wallet-evm-primary-wallet"],
            },
            { name: "Other", wallets: ["connect-wallet-evm-other-wallet"] },
          ])
        );
      })
  );

  it.effect(
    "shows remote wallets while an extension probe is still pending",
    () =>
      Effect.gen(function* () {
        yield* openPicker({
          groups: singleGroup(
            { id: "slow-extension", injected: { unsettled: true } },
            { id: "metamask" },
            { id: "talisman", family: substrate }
          ),
        });

        yield* waitFor("connect-ecosystem-evm");
        expect(element("connect-ecosystem-substrate")).not.toBeNull();
        yield* click(() => element("connect-ecosystem-evm"));
        yield* waitFor("connect-wallet-evm-metamask");
        expect(element("connect-wallet-evm-slow-extension")).toBeNull();
      })
  );

  it.effect(
    "keeps a host group named Installed apart from detected extensions",
    () =>
      Effect.gen(function* () {
        yield* openPicker({
          extensions: ["extension"],
          groups: [
            { groupName: "Installed", wallets: [{ id: "host-remote" }] },
            {
              groupName: "Wallets",
              wallets: [{ id: "extension", injected: {} }],
            },
          ],
        });
        yield* waitFor("connect-wallet-evm-extension");

        yield* Effect.promise(() =>
          expect.poll(walletGroups).toEqual([
            { name: "Installed", wallets: ["connect-wallet-evm-extension"] },
            { name: "Installed", wallets: ["connect-wallet-evm-host-remote"] },
          ])
        );
      })
  );

  it.effect("detects extensions each time the picker opens", () =>
    Effect.gen(function* () {
      const picker = yield* openPicker({
        groups: singleGroup(
          { id: "remote" },
          { id: "extension", injected: { installUrl: "https://example.com" } }
        ),
      });
      yield* waitFor("connect-wallet-evm-extension");
      expect(element("connect-wallet-evm-extension")?.tagName).toBe("A");

      yield* picker.install("extension");
      yield* click(() => document.querySelector('button[aria-label="Close"]'));
      yield* Effect.promise(() =>
        expect.poll(() => element("wallet-connect-dialog")).toBeNull()
      );
      yield* click(() => button("Open wallets"));
      yield* Effect.promise(() =>
        expect
          .poll(() => element("connect-wallet-evm-extension")?.tagName)
          .toBe("BUTTON")
      );
      yield* click(() => element("connect-wallet-evm-extension"));

      expect(yield* picker.calls).toEqual([
        { walletId: "extension", chainId: undefined },
      ]);
    })
  );

  it.effect(
    "offers to install a missing extension on desktop instead of connecting",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          groups: singleGroup(
            {
              id: "fireblocks",
              injected: { installUrl: "https://example.com/fireblocks" },
            },
            { id: "metamask" }
          ),
        });
        yield* waitFor("connect-wallet-evm-fireblocks");

        const install = element("connect-wallet-evm-fireblocks");
        expect(install?.tagName).toBe("A");
        expect(install?.textContent).toContain("Install");
        expect(install?.getAttribute("href")).toBe(
          "https://example.com/fireblocks"
        );
        expect(install?.getAttribute("target")).toBe("_blank");

        yield* click(() => element("connect-wallet-evm-fireblocks"));
        expect(yield* picker.calls).toEqual([]);
      })
  );

  it.effect.each([
    {
      name: "on mobile",
      device: "mobile",
      injected: { installUrl: "https://example.com/extension" },
    },
    { name: "without a store page", device: "desktop", injected: {} },
  ] as const)("hides a missing extension $name", ({ device, injected }) =>
    Effect.gen(function* () {
      yield* openPicker({
        device,
        groups: singleGroup({ id: "extension", injected }, { id: "remote" }),
      });
      yield* waitFor("connect-wallet-evm-remote");

      expect(element("connect-wallet-evm-extension")).toBeNull();
    })
  );

  it.effect("hides ecosystems without available wallets", () =>
    Effect.gen(function* () {
      yield* openPicker({
        groups: singleGroup(
          { id: "metamask" },
          { id: "talisman", family: substrate, injected: {} }
        ),
      });

      // A single remaining ecosystem opens straight onto its wallets.
      yield* waitFor("connect-wallet-evm-metamask");
      expect(element("connect-ecosystem-substrate")).toBeNull();
    })
  );

  it.effect(
    "tells the user an extension removed after opening is not available",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          extensions: ["extension"],
          groups: singleGroup({ id: "extension", injected: {} }),
        });
        yield* waitFor("connect-wallet-evm-extension");

        yield* picker.uninstall("extension");
        yield* click(() => element("connect-wallet-evm-extension"));

        yield* Effect.promise(() =>
          expect
            .poll(() => document.querySelector('[role="alert"]')?.textContent)
            .toBe(
              "This wallet is no longer available. Enable or install its extension and try again."
            )
        );
        expect(yield* picker.calls).toEqual([]);
      })
  );

  it.effect("shows the provider disclaimer", () =>
    Effect.gen(function* () {
      yield* openPicker({ groups: singleGroup({ id: "metamask" }) });

      expect(element("wallet-connect-dialog")?.textContent).toContain(
        "Powered by Yield.xyz"
      );
    })
  );

  it.effect.each([
    { outcome: "connect", extensions: ["extension"], tagName: "BUTTON" },
    { outcome: "install", extensions: [], tagName: "A" },
  ])(
    "shows an extension still being checked in place until it offers to $outcome",
    ({ extensions, tagName }) =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          extensions,
          groups: singleGroup(
            { id: "first" },
            {
              id: "extension",
              injected: {
                installUrl: "https://example.com/extension",
                unsettled: true,
              },
            },
            { id: "last" }
          ),
        });
        yield* waitFor("connect-wallet-evm-extension");
        const rows = [
          "connect-wallet-evm-first",
          "connect-wallet-evm-extension",
          "connect-wallet-evm-last",
        ];
        expect(walletRows()).toEqual(rows);
        const checking = element("connect-wallet-evm-extension");
        expect(checking?.getAttribute("aria-busy")).toBe("true");
        expect(checking?.textContent).toContain("Checking");

        yield* picker.settle("extension");
        yield* pollTagName("connect-wallet-evm-extension", tagName);

        expect(walletRows()).toEqual(rows);
        expect(
          element("connect-wallet-evm-extension")?.getAttribute("aria-busy")
        ).toBeNull();
      })
  );

  it.effect(
    "keeps an extension detected after opening in its group until the next open",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          extensions: ["extension"],
          groups: [
            { groupName: "Primary", wallets: [{ id: "remote" }] },
            {
              groupName: "Other",
              wallets: [
                {
                  id: "extension",
                  injected: {
                    installUrl: "https://example.com/extension",
                    unsettled: true,
                  },
                },
              ],
            },
          ],
        });
        yield* waitFor("connect-wallet-evm-extension");

        yield* picker.settle("extension");
        yield* pollTagName("connect-wallet-evm-extension", "BUTTON");
        expect(walletGroups()).toEqual([
          { name: "Primary", wallets: ["connect-wallet-evm-remote"] },
          { name: "Other", wallets: ["connect-wallet-evm-extension"] },
        ]);

        yield* closePicker;
        yield* showPicker;
        yield* waitFor("connect-wallet-evm-extension");
        expect(walletGroups()).toEqual([
          { name: "Installed", wallets: ["connect-wallet-evm-extension"] },
          { name: "Primary", wallets: ["connect-wallet-evm-remote"] },
        ]);
      })
  );

  it.effect(
    "reopens with the last detection while checking again, updating in place",
    () =>
      Effect.gen(function* () {
        const picker = yield* openPicker({
          groups: singleGroup(
            { id: "remote" },
            {
              id: "extension",
              injected: { installUrl: "https://example.com/extension" },
            }
          ),
        });
        yield* pollTagName("connect-wallet-evm-extension", "A");
        yield* closePicker;

        yield* picker.hold("extension");
        yield* showPicker;
        yield* waitFor("connect-wallet-evm-extension");
        expect(element("connect-wallet-evm-extension")?.tagName).toBe("A");
        const rows = walletRows();

        yield* picker.install("extension");
        yield* picker.settle("extension");
        yield* pollTagName("connect-wallet-evm-extension", "BUTTON");
        expect(walletRows()).toEqual(rows);
      })
  );

  it.effect("detects extensions before the picker first opens", () =>
    Effect.gen(function* () {
      const picker = yield* renderPicker({
        groups: singleGroup(
          { id: "remote" },
          {
            id: "extension",
            injected: { installUrl: "https://example.com/extension" },
          }
        ),
      });
      yield* Effect.promise(() =>
        expect.poll(() => picker.settledProbes("extension")).toBeGreaterThan(0)
      );

      yield* picker.hold("extension");
      yield* showPicker;
      yield* waitFor("connect-wallet-evm-extension");
      expect(element("connect-wallet-evm-extension")?.tagName).toBe("A");
    })
  );
});
