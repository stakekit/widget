import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { avalanche, mainnet, sepolia } from "viem/chains";
import { page, userEvent } from "vitest/browser";

import { SKApp } from "../../../src/App";
import type { SupportedSKChainIds } from "../../../src/domain/wallet/chain-ids";
import type { SKAppProps } from "../../../src/public-api/react-types";
import {
  solana,
  ton,
} from "../../../src/services/wallet/internal/adapters/configured-chains";
import { setup } from "../../app/journeys/external-provider/setup";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { network } from "../../mocks/network";
import { mockWalletListFactory } from "../../utils/mock-connector";
import { describe, expect, it, vi } from "../../utils/test-extend";
import { render, renderApp } from "../../utils/test-utils";
import { makeWalletConnectPicker } from "../../utils/wallet-connect-picker";

const renderPicker = Effect.fn("renderPicker")(function* (
  options: Omit<Parameters<typeof makeWalletConnectPicker>[0], "api">
) {
  const picker = yield* makeWalletConnectPicker({ ...options, api: network });
  yield* Effect.acquireRelease(
    Effect.promise(async () => render(picker.element)),
    (screen) =>
      picker.declinePending.pipe(
        Effect.andThen(Effect.promise(() => screen.unmount()))
      )
  );
  const opener = page.getByRole("button", {
    name: "Open wallets",
    exact: true,
  });
  yield* Effect.promise(() => opener.click());
  const dialog = page.getByTestId("wallet-connect-dialog");
  yield* Effect.promise(() => expect.element(dialog).toBeVisible());
  return { dialog, opener } as const;
});

describe("wallet connection picker", () => {
  it.live(
    "keeps the close control in view and scrolls a long wallet list on a short viewport",
    () =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.promise(() => page.viewport(420, 240)),
          () => Effect.promise(() => page.viewport(1280, 720))
        );
        const { dialog } = yield* renderPicker({
          groups: [
            {
              groupName: "Wallets",
              wallets: Array.from({ length: 20 }, (_, index) => ({
                id: `wallet-${index}`,
              })),
            },
          ],
        });
        const close = dialog.getByRole("button", {
          name: "Close",
          exact: true,
        });
        yield* Effect.promise(() =>
          expect
            .poll(() => {
              const bounds = close.element().getBoundingClientRect();
              return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
            })
            .toBe(true)
        );

        const last = page.getByTestId("connect-wallet-evm-wallet-19");
        yield* Effect.promise(() => expect.element(last).toBeInTheDocument());
        last.element().scrollIntoView({ block: "end" });
        yield* Effect.promise(() =>
          expect
            .poll(() => last.element().getBoundingClientRect().bottom)
            .toBeLessThanOrEqual(window.innerHeight)
        );
        expect(
          page.getByTestId("wallet-connect-list").element().scrollTop
        ).toBeGreaterThan(0);
        expect(
          close.element().getBoundingClientRect().top
        ).toBeGreaterThanOrEqual(0);
      })
  );

  it.live(
    "returns focus to the opener on close but not while AppKit is presented",
    () =>
      Effect.gen(function* () {
        const { dialog, opener } = yield* renderPicker({
          groups: [{ groupName: "Wallets", wallets: [{ id: "metamask" }] }],
        });
        // The modal makes the rest of the page inert, so dispatch the click.
        page
          .getByText("Present AppKit", { exact: true })
          .element()
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        yield* Effect.promise(() =>
          expect.element(dialog).not.toBeInTheDocument()
        );
        expect(document.activeElement).not.toBe(opener.element());

        yield* Effect.promise(() =>
          page
            .getByRole("button", { name: "Close AppKit", exact: true })
            .click()
        );
        yield* Effect.promise(() => expect.element(dialog).toBeVisible());
        yield* Effect.promise(() => userEvent.keyboard("[Escape]"));
        yield* Effect.promise(() =>
          expect.element(dialog).not.toBeInTheDocument()
        );
        yield* Effect.promise(() => expect.element(opener).toHaveFocus());
      })
  );

  it.live("lists wallets in compact rows", () =>
    Effect.gen(function* () {
      yield* renderPicker({
        groups: [
          {
            groupName: "Wallets",
            wallets: [{ id: "metamask" }, { id: "rabby" }],
          },
        ],
      });
      for (const id of ["metamask", "rabby"]) {
        const row = page.getByTestId(`connect-wallet-evm-${id}`);
        yield* Effect.promise(() => expect.element(row).toBeVisible());
        expect(
          row.element().getBoundingClientRect().height
        ).toBeLessThanOrEqual(56);
        // A picker row has no surface of its own; it tints on hover only.
        expect(getComputedStyle(row.element()).backgroundColor).toBe(
          "rgba(0, 0, 0, 0)"
        );
      }
    })
  );
});

/** Opens the network picker of a generic wallet connected to Ethereum. */
const openNetworkPicker = async ({
  api,
  supportedChainIds,
  switchChain = async () => {},
  dashboardVariant = false,
  networks,
}: {
  readonly api: typeof network;
  readonly supportedChainIds: ReadonlyArray<SupportedSKChainIds>;
  readonly switchChain?: (chainId: number) => Promise<void>;
  readonly dashboardVariant?: boolean;
  /** The networks the API enables, in place of the setup's. */
  readonly networks?: ReadonlyArray<string>;
}) => {
  setup(api);
  if (networks !== undefined) {
    api.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json(networks.map((id) => ({ id })))
      )
    );
  }
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      dashboardVariant,
      externalProviders: {
        type: "generic",
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [...supportedChainIds],
        provider: {
          switchChain,
          signMessage: async () => "signature",
          sendTransaction: async () => "hash",
        },
      },
    },
  });
  await app.getByRole("button", { name: "Ethereum", exact: true }).click();
  const dialog = page.getByTestId("wallet-chain-dialog");
  await expect.element(dialog).toBeVisible();
  const search = dialog.getByRole("combobox", {
    name: "Search networks",
    exact: true,
  });
  return { app, dialog, search } as const;
};

it("keeps every chain reachable by keyboard inside a short viewport", async ({
  worker,
}) => {
  const switchChain = vi.fn(async (_chainId: number) => {});
  await page.viewport(420, 240);

  try {
    const { app, dialog, search } = await openNetworkPicker({
      api: worker,
      supportedChainIds: [mainnet.id, avalanche.id, solana.id, ton.id],
      switchChain,
    });
    await expect
      .poll(() => {
        const bounds = dialog.element().getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
      })
      .toBe(true);

    // The arrow keys move from the connected network through the rest.
    await expect.element(search).toHaveFocus();
    for (const chainId of [avalanche.id, solana.id, ton.id]) {
      await userEvent.keyboard("[ArrowDown]");
      const choice = app.getByTestId(`wallet-chain-${chainId}`);
      await expect
        .element(search)
        .toHaveAttribute("aria-activedescendant", choice.element().id);
      await expect
        .poll(() => {
          const bounds = choice.element().getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        })
        .toBe(true);
    }

    await userEvent.keyboard("[Enter]");
    await expect.poll(() => switchChain).toHaveBeenCalledWith(ton.id);
    await expect.element(dialog).not.toBeInTheDocument();
  } finally {
    await page.viewport(1280, 720);
  }
});

it("lists networks in compact rows and marks the connected one without a chip", async ({
  worker,
}) => {
  const { dialog, search } = await openNetworkPicker({
    api: worker,
    supportedChainIds: [mainnet.id, avalanche.id],
  });
  const current = dialog.getByTestId(`wallet-chain-${mainnet.id}`);
  const other = dialog.getByTestId(`wallet-chain-${avalanche.id}`);
  await expect.element(current).toBeVisible();

  // Focus starts in the search field, so the close button shows no ring.
  await expect.element(search).toHaveFocus();
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  expect(getComputedStyle(close.element()).outlineStyle).toBe("none");

  await expect.element(current).toHaveAttribute("aria-selected", "true");
  await expect.element(other).toHaveAttribute("aria-selected", "false");
  await expect
    .element(dialog.getByText("Connected", { exact: true }))
    .not.toBeInTheDocument();
  const heights = [current, other].map(
    (row) => row.element().getBoundingClientRect().height
  );
  for (const height of heights) expect(height).toBeLessThanOrEqual(40);
  expect(heights[0]).toBe(heights[1]);
  // The connected network is tinted; others tint on hover only.
  expect(getComputedStyle(current.element()).backgroundColor).not.toBe(
    "rgba(0, 0, 0, 0)"
  );
  expect(getComputedStyle(other.element()).backgroundColor).toBe(
    "rgba(0, 0, 0, 0)"
  );

  // Each icon starts on the title's edge.
  const edge = dialog
    .getByRole("heading", { name: "Switch networks", exact: true })
    .element()
    .getBoundingClientRect().left;
  for (const row of [current, other]) {
    const icon = row.element().firstElementChild?.getBoundingClientRect();
    expect(icon?.width).toBe(24);
    expect(Math.abs((icon?.left ?? 0) - edge)).toBeLessThanOrEqual(1);
  }
  await close.click();
  await expect.element(dialog).not.toBeInTheDocument();
});

it("lists the connected network first, then the networks, then the testnets", async ({
  worker,
}) => {
  const { dialog } = await openNetworkPicker({
    api: worker,
    supportedChainIds: [avalanche.id, sepolia.id, mainnet.id],
    networks: ["ethereum", "avalanche-c", "ethereum-sepolia"],
  });
  await expect
    .element(dialog.getByTestId(`wallet-chain-${sepolia.id}`))
    .toBeInTheDocument();
  const options = dialog.getByRole("option").elements();
  expect(options.map((option) => option.getAttribute("data-testid"))).toEqual(
    [mainnet.id, avalanche.id, sepolia.id].map((id) => `wallet-chain-${id}`)
  );
  const [current, network, testnet] = options;
  expect(current).toHaveAccessibleDescription("Current");
  expect(network).toHaveAccessibleDescription("Networks");
  expect(testnet).toHaveAccessibleDescription("Testnets");
});

it("filters networks by name and switches to the one Enter chooses", async ({
  worker,
}) => {
  const switchChain = vi.fn(async (_chainId: number) => {});
  const { dialog, search } = await openNetworkPicker({
    api: worker,
    supportedChainIds: [mainnet.id, avalanche.id, solana.id],
    switchChain,
  });
  await userEvent.type(search, "zzz");
  // Shown in place of the list, and announced from the search field's status.
  await expect
    .element(dialog.getByRole("status"))
    .toHaveTextContent("No networks found");
  expect(dialog.getByRole("option").elements()).toEqual([]);

  await userEvent.clear(search);
  await userEvent.type(search, "aval");
  await expect
    .poll(() =>
      dialog
        .getByRole("option")
        .elements()
        .map((option) => option.getAttribute("data-testid"))
    )
    .toEqual([`wallet-chain-${avalanche.id}`]);

  await userEvent.keyboard("[ArrowDown][Enter]");
  await expect.poll(() => switchChain).toHaveBeenCalledWith(avalanche.id);
});

it("narrows the Dashboard's network picker to 400px", async ({ worker }) => {
  const { dialog } = await openNetworkPicker({
    api: worker,
    supportedChainIds: [mainnet.id, avalanche.id],
    dashboardVariant: true,
  });
  expect(dialog.element().getBoundingClientRect().width).toBeLessThanOrEqual(
    400
  );
});

it("copies the full account address and clears copied feedback", async ({
  worker,
}) => {
  setup(worker);
  const address = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);

  try {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        externalProviders: {
          type: "generic",
          currentAddress: address,
          supportedChainIds: [mainnet.id],
          provider: {
            switchChain: async () => {},
            signMessage: async () => "signature",
            sendTransaction: async () => "hash",
          },
        },
      },
    });
    await app.getByRole("button", { name: "0xB6…B2F7", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Account", exact: true });
    const copy = dialog.getByTestId("wallet-account-copy");
    await expect.element(copy).toHaveAccessibleName("Copy address");
    // The host signs for the user: no wallet the user picked to name.
    await expect
      .element(dialog.getByText("Connected to Ethereum", { exact: true }))
      .toBeVisible();
    await expect
      .element(dialog.getByText("External Provider", { exact: true }))
      .not.toBeInTheDocument();

    await copy.click();

    await expect.poll(() => writeText).toHaveBeenCalledWith(address);
    // Shown beside the address, as well as announced; then cleared.
    const copied = dialog.getByText("Copied!", { exact: true }).first();
    await expect.element(copied).toBeVisible();
    expect(copied.element().getBoundingClientRect().width).toBeGreaterThan(1);
    await expect.element(copy).toHaveAccessibleName("Copy address");
    await expect.element(copied).not.toBeInTheDocument();
  } finally {
    writeText.mockRestore();
  }
});

const accountAddress = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

/** Renders a connected mock wallet holding 1.5 ETH on Ethereum. */
const renderAccountDialog = async (
  api: typeof network,
  language: "en" | "fr" = "en"
) => {
  setup(api);
  api.use(
    http.post(legacyApiRoute("/v1/tokens/balances"), () =>
      HttpResponse.json([
        {
          token: {
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
            network: "ethereum",
            coinGeckoId: "ethereum",
          },
          amount: "1.5",
          availableYields: [],
        },
      ])
    )
  );
  const app = await renderApp({
    walletListFactory: mockWalletListFactory({ accounts: [accountAddress] }),
    skProps: { apiKey: import.meta.env.VITE_API_KEY, language },
  });
  const trigger = app.getByRole("button", { name: "0xB6…B2F7", exact: true });
  await expect.element(trigger).toBeVisible();
  return { app, trigger };
};

it("titles the account dialog and shows the account, its network and balance", async ({
  worker,
}) => {
  const { trigger } = await renderAccountDialog(worker);
  // Opened from the keyboard, where a focused control would show its ring.
  trigger.element().focus();
  await userEvent.keyboard("[Enter]");
  const dialog = page.getByRole("dialog", { name: "Account", exact: true });
  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog.getByRole("heading", { name: "Account", exact: true }))
    .toBeVisible();

  // Focus starts on the dialog, so the close button shows no focus ring.
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await expect.element(dialog).toHaveFocus();
  expect(getComputedStyle(close.element()).outlineStyle).toBe("none");

  await expect
    .element(dialog.getByText("0xB6…B2F7", { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByText("Mock Connector", { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByText("Connected to Ethereum", { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByText("1.5 ETH", { exact: true }))
    .toBeVisible();

  const explorer = dialog.getByRole("link", { name: /^View on explorer/ });
  await expect
    .element(explorer)
    .toHaveAttribute("href", `https://etherscan.io/address/${accountAddress}`);
  await expect.element(explorer).toHaveAttribute("target", "_blank");
});

it("lays out the explorer and disconnect actions side by side at equal width", async ({
  worker,
}) => {
  await page.viewport(480, 720);
  try {
    const { trigger } = await renderAccountDialog(worker);
    await trigger.click();
    const dialog = page.getByTestId("wallet-account-dialog");
    const explorer = dialog.getByRole("link", { name: /^View on explorer/ });
    const disconnect = dialog.getByTestId("wallet-account-disconnect");
    await expect.element(explorer).toBeVisible();
    await expect.element(disconnect).toBeVisible();

    const explorerBox = explorer.element().getBoundingClientRect();
    const disconnectBox = disconnect.element().getBoundingClientRect();
    expect(disconnectBox.top).toBe(explorerBox.top);
    expect(explorerBox.right).toBeLessThanOrEqual(disconnectBox.left);
    expect(Math.abs(explorerBox.width - disconnectBox.width)).toBeLessThan(1);
    for (const action of [explorer.element(), disconnect.element()]) {
      expect(textLineCount(action)).toBe(1);
      expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth);
    }
  } finally {
    await page.viewport(1280, 720);
  }
});

it("stacks the actions when their labels don't fit side by side", async ({
  worker,
}) => {
  await page.viewport(360, 720);
  try {
    const { trigger } = await renderAccountDialog(worker, "fr");
    await trigger.click();
    const dialog = page.getByTestId("wallet-account-dialog");
    const explorer = dialog.getByRole("link", {
      name: /^Voir dans l'explorateur/,
    });
    const disconnect = dialog.getByTestId("wallet-account-disconnect");
    await expect.element(explorer).toBeVisible();

    const explorerBox = explorer.element().getBoundingClientRect();
    const disconnectBox = disconnect.element().getBoundingClientRect();
    expect(disconnectBox.top).toBeGreaterThanOrEqual(explorerBox.bottom);
    expect(disconnectBox.width).toBe(explorerBox.width);
    for (const action of [explorer.element(), disconnect.element()]) {
      expect(textLineCount(action)).toBe(1);
      expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth);
    }
  } finally {
    await page.viewport(1280, 720);
  }
});

it("disconnects the wallet from the account dialog", async ({ worker }) => {
  const { app, trigger } = await renderAccountDialog(worker);
  await trigger.click();
  const dialog = page.getByTestId("wallet-account-dialog");
  await dialog.getByTestId("wallet-account-disconnect").click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(trigger).not.toBeInTheDocument();
  await expect
    .element(app.getByRole("button", { name: "0xB6…B2F7", exact: true }))
    .not.toBeInTheDocument();
});

/** How many lines the text inside an element runs over. */
const textLineCount = (element: Element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const tops = new Set<number>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width > 0) tops.add(Math.round(rect.top));
    }
  }
  return tops.size;
};

it("clears a failed network selection when the dialog is reopened", async ({
  worker,
}) => {
  setup(worker);
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [mainnet.id, avalanche.id],
        provider: {
          switchChain: async () => {
            throw new Error("Wallet unavailable");
          },
          signMessage: async () => "signature",
          sendTransaction: async () => "hash",
        },
      },
    },
  });
  const open = app.getByRole("button", { name: "Ethereum", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId(`wallet-chain-${avalanche.id}`).click();
  // The search field's own status announces only a search with no match.
  const failed = dialog
    .getByRole("status")
    .filter({ hasText: "Error switching chain" });
  await expect.element(failed).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  // The connected network's row is also named "Ethereum" until it unmounts.
  await expect.element(dialog).not.toBeInTheDocument();
  await open.click();
  await expect.element(dialog).toBeVisible();
  await expect.element(failed).not.toBeInTheDocument();
});

it("keeps the header wallet summary mounted while switching networks", async ({
  worker,
}) => {
  setup(worker);
  const app = await renderApp({
    walletListFactory: mockWalletListFactory({
      accounts: ["0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7"],
    }),
    skProps: { apiKey: import.meta.env.VITE_API_KEY },
  });
  await app.getByRole("button", { name: "Ethereum", exact: true }).click();
  const missingSummaries = new Set<string>();
  const observer = new MutationObserver(() => {
    const header = app.container.querySelector('[data-rk="header"]');
    for (const summary of ["chain", "account"]) {
      if (!header?.querySelector(`[data-rk="${summary}-modal-container"]`)) {
        missingSummaries.add(summary);
      }
    }
  });
  observer.observe(app.container, { childList: true, subtree: true });

  try {
    await page.getByTestId(`wallet-chain-${avalanche.id}`).click();
    await expect
      .element(app.getByRole("button", { name: "Avalanche", exact: true }))
      .toBeVisible();
    expect([...missingSummaries]).toEqual([]);
  } finally {
    observer.disconnect();
  }
});

it.for(["account", "chain"] as const)(
  "does not reopen the %s dialog after an external disconnect",
  async (kind, { worker }) => {
    setup(worker);
    const skProps = {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        currentAddress: "0x1111111111111111111111111111111111111111",
        supportedChainIds: [mainnet.id, avalanche.id],
        provider: {
          switchChain: async () => {},
          signMessage: async () => "signature",
          sendTransaction: async () => "hash",
        },
      },
    } satisfies SKAppProps;
    const app = await renderApp({ skProps });
    await app
      .getByRole("button", {
        name: kind === "account" ? "0x11…1111" : "Ethereum",
        exact: true,
      })
      .click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{ ...skProps.externalProviders, currentAddress: "" }}
      />
    );
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{
          ...skProps.externalProviders,
          currentAddress: "0x2222222222222222222222222222222222222222",
        }}
      />
    );
    await expect
      .element(app.getByRole("button", { name: "0x22…2222", exact: true }))
      .toBeVisible();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  }
);

it.for(["account", "chain"] as const)(
  "restores keyboard focus after closing the %s dialog",
  async (kind, { worker }) => {
    setup(worker);
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        externalProviders: {
          type: "generic",
          currentAddress: "0x1111111111111111111111111111111111111111",
          supportedChainIds: [mainnet.id, avalanche.id],
          provider: {
            switchChain: async () => {},
            signMessage: async () => "signature",
            sendTransaction: async () => "hash",
          },
        },
      },
    });
    const trigger = app.getByRole("button", {
      name: kind === "account" ? "0x11…1111" : "Ethereum",
      exact: true,
    });
    await trigger.click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("[Escape]");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
  }
);

it.for([
  ["Compact", false],
  ["Dashboard", true],
] as const)(
  "sizes the %s Layout's header wallet pills to their row",
  async ([, dashboardVariant], { worker }) => {
    setup(worker);
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant,
        externalProviders: {
          type: "generic",
          currentAddress: "0x1111111111111111111111111111111111111111",
          supportedChainIds: [mainnet.id, avalanche.id],
          provider: {
            switchChain: async () => {},
            signMessage: async () => "signature",
            sendTransaction: async () => "hash",
          },
        },
      },
    });
    const pills = [
      app.getByRole("button", { name: "Ethereum", exact: true }),
      app.getByRole("button", { name: "0x11…1111", exact: true }),
    ];
    for (const pill of pills) await expect.element(pill).toBeVisible();
    // Beside the Dashboard's tabs, as tall as their list; otherwise as tall
    // as a small control.
    const height = dashboardVariant
      ? app.getByRole("tablist").first().element().getBoundingClientRect()
          .height
      : 32;
    for (const pill of pills) {
      expect(pill.element().getBoundingClientRect().height).toBe(height);
    }
  }
);
