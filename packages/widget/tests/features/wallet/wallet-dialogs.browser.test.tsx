import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { avalanche, mainnet } from "viem/chains";
import { page, userEvent } from "vitest/browser";
import { SKApp } from "../../../src/App";
import type { SKAppProps } from "../../../src/public-api/react-types";
import {
  solana,
  ton,
} from "../../../src/services/wallet/internal/adapters/configured-chains";
import { setup } from "../../app/journeys/external-provider/setup";
import { legacyApiRoute } from "../../mocks/api-routes";
import { worker } from "../../mocks/worker";
import { mockWalletListFactory } from "../../utils/mock-connector";
import { describe, expect, it, vi } from "../../utils/test-extend";
import { render, renderApp } from "../../utils/test-utils";
import { makeWalletConnectPicker } from "../../utils/wallet-connect-picker";

const renderPicker = Effect.fn("renderPicker")(function* (
  options: Omit<Parameters<typeof makeWalletConnectPicker>[0], "api">
) {
  const picker = yield* makeWalletConnectPicker({ ...options, api: worker });
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

it("keeps every chain reachable by keyboard inside a short viewport", async ({
  worker,
}) => {
  setup(worker);
  const switchChain = vi.fn(async (_chainId: number) => {});
  await page.viewport(420, 240);

  try {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        externalProviders: {
          type: "generic",
          currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
          supportedChainIds: [mainnet.id, avalanche.id, solana.id, ton.id],
          provider: {
            switchChain,
            signMessage: async () => "signature",
            sendTransaction: async () => "hash",
          },
        },
      },
    });

    await app.getByRole("button", { name: "Ethereum", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    await expect
      .poll(() => {
        const bounds = dialog.element().getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
      })
      .toBe(true);

    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await expect.element(close).toBeVisible();
    close.element().focus();

    for (const chainId of [mainnet.id, avalanche.id, solana.id, ton.id]) {
      await userEvent.keyboard("[Tab]");
      const choice = app.getByTestId(`wallet-chain-${chainId}`);
      await expect.element(choice).toHaveFocus();
      const bounds = choice.element().getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
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
  setup(worker);
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [mainnet.id, avalanche.id],
        provider: {
          switchChain: async () => {},
          signMessage: async () => "signature",
          sendTransaction: async () => "hash",
        },
      },
    },
  });
  await app.getByRole("button", { name: "Ethereum", exact: true }).click();
  const dialog = page.getByTestId("wallet-chain-dialog");
  const current = dialog.getByTestId(`wallet-chain-${mainnet.id}`);
  const other = dialog.getByTestId(`wallet-chain-${avalanche.id}`);
  await expect.element(current).toBeVisible();

  await expect.element(current).toHaveAttribute("aria-pressed", "true");
  await expect.element(other).toHaveAttribute("aria-pressed", "false");
  await expect
    .element(dialog.getByText("Connected", { exact: true }))
    .not.toBeInTheDocument();
  const heights = [current, other].map(
    (row) => row.element().getBoundingClientRect().height
  );
  for (const height of heights) expect(height).toBeLessThanOrEqual(56);
  expect(heights[0]).toBe(heights[1]);
  // Rows have no surface of their own; they tint on hover only.
  expect(getComputedStyle(other.element()).backgroundColor).toBe(
    "rgba(0, 0, 0, 0)"
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect.element(dialog).not.toBeInTheDocument();
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
    await expect.element(copy).toHaveAccessibleName("Copy Address");

    await copy.click();

    await expect.poll(() => writeText).toHaveBeenCalledWith(address);
    // Shown beside the address, as well as announced; then cleared.
    const copied = dialog.getByText("Copied!", { exact: true }).first();
    await expect.element(copied).toBeVisible();
    expect(copied.element().getBoundingClientRect().width).toBeGreaterThan(1);
    await expect.element(copy).toHaveAccessibleName("Copy Address");
    await expect.element(copied).not.toBeInTheDocument();
  } finally {
    writeText.mockRestore();
  }
});

const accountAddress = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

/** Renders a connected mock wallet holding 1.5 ETH on Ethereum. */
const renderAccountDialog = async (
  api: typeof worker,
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
  await expect.element(dialog.getByRole("status")).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  // The connected network's row is also named "Ethereum" until it unmounts.
  await expect.element(dialog).not.toBeInTheDocument();
  await open.click();
  await expect.element(dialog.getByRole("status")).not.toBeInTheDocument();
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
