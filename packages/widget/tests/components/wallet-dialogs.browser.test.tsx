import { Effect } from "effect";
import { avalanche, mainnet } from "viem/chains";
import { page, userEvent } from "vitest/browser";
import { SKApp } from "../../src/App";
import type { SKAppProps } from "../../src/public-api/react-types";
import {
  solana,
  ton,
} from "../../src/services/wallet/internal/adapters/configured-chains";
import { worker } from "../mocks/worker";
import { setup } from "../use-cases/external-provider/setup";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render, renderApp } from "../utils/test-utils";
import { makeWalletConnectPicker } from "../utils/wallet-connect-picker";

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
    const dialog = page.getByRole("dialog", { name: "0xB6…B2F7", exact: true });
    const copy = dialog.getByRole("button", {
      name: "Copy Address",
      exact: true,
    });

    await copy.click();

    await expect.poll(() => writeText).toHaveBeenCalledWith(address);
    await expect
      .element(dialog.getByRole("button", { name: "Copied!", exact: true }))
      .toBeVisible();
    await expect.element(copy).toBeVisible();
  } finally {
    writeText.mockRestore();
  }
});

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
  await open.click();
  await expect.element(dialog.getByRole("status")).not.toBeInTheDocument();
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
