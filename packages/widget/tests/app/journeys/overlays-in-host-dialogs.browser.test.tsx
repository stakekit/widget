import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as RadixDialog from "@radix-ui/react-dialog";
import { HttpResponse, http } from "msw";
import { type PropsWithChildren, useState } from "react";
import { onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ThemeRoot } from "../../../src/ui/composition";
import { Button, Modal, Select, Tooltip } from "../../../src/ui/index";
import { yieldApiRoute } from "../../mocks/api-routes";
import type { TestWorker } from "../../utils/test-extend";
import { describe, expect, it, vi } from "../../utils/test-extend";
import { render, renderApp } from "../../utils/test-utils";

const hostDialogName = "Host dialog";

/** Answers the Widget's first request with a geo block, so it opens its help dialog. */
const geoBlock = (worker: TestWorker) =>
  worker.use(
    http.get(yieldApiRoute("/v1/networks"), () =>
      HttpResponse.json(
        {
          code: 403,
          countryCode: "AT",
          message: "Access denied",
          regionCode: "AT-9",
          type: "GEO_LOCATION",
        },
        { status: 403 }
      )
    )
  );

type HostDialog = (
  props: PropsWithChildren<{ readonly onOpenChange: (open: boolean) => void }>
) => React.ReactElement;

const RadixHostDialog: HostDialog = ({ children, onOpenChange }) => {
  const [open, setOpen] = useState(true);
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Content data-host-dialog="" aria-describedby={undefined}>
          <RadixDialog.Title>{hostDialogName}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

const BaseUiHostDialog: HostDialog = ({ children, onOpenChange }) => {
  const [open, setOpen] = useState(true);
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Popup data-host-dialog="">
          <BaseDialog.Title>{hostDialogName}</BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
};

const hosts = [
  { name: "Radix", HostDialog: RadixHostDialog },
  { name: "Base UI", HostDialog: BaseUiHostDialog },
] as const;

const hostDialog = () => document.querySelector("[data-host-dialog]");

/**
 * The element inside the host dialog a Widget mounts into. Published bundles
 * carry their own React and Base UI, so the Widget is rendered there as a
 * separate React root, sharing no context with the host dialog.
 */
const widgetMount = async () => {
  await expect
    .poll(() => document.querySelector("[data-widget-mount]"))
    .not.toBeNull();
  const mount = document.querySelector("[data-widget-mount]");
  if (!(mount instanceof HTMLElement)) throw new Error("No Widget mount");
  return mount;
};

const expectFocusWithin = async (element: Element) =>
  expect.poll(() => element.contains(document.activeElement)).toBe(true);

type Network = "ethereum" | "solana";

const NetworkSelect = () => {
  const [network, setNetwork] = useState<Network | null>("ethereum");
  return (
    <Select<Network>
      label="Network"
      options={[
        { value: "ethereum", label: "Ethereum" },
        { value: "solana", label: "Solana" },
      ]}
      value={network}
      onValueChange={setNetwork}
    />
  );
};

/** Select and Tooltip inside the Widget's theme root and portal container. */
const OverlayFixture = () => (
  <ThemeRoot
    appearance={{}}
    appearancePreset="default"
    callToActionSize="lg"
    colorScheme="light"
    gutter="md"
    surfaceStyle="filled"
    tabsIndicator="underline"
    portalContainer={undefined}
  >
    <NetworkSelect />
    <Tooltip label="Copy address">
      <Button>Copy</Button>
    </Tooltip>
  </ThemeRoot>
);

describe.each(hosts)(
  "Widget popups inside a host $name dialog",
  ({ HostDialog }) => {
    it("keeps focus, Escape and clicks inside the help Modal", async ({
      worker,
    }) => {
      geoBlock(worker);
      const onHostOpenChange = vi.fn();
      const host = await render(
        <HostDialog onOpenChange={onHostOpenChange}>
          <div data-widget-mount="" />
        </HostDialog>
      );
      const app = await renderApp({
        options: { container: await widgetMount() },
      });

      const modal = app.getByRole("dialog", { name: "Geo Block" });
      await expect.element(modal).toBeVisible();
      const modalElement = modal.element();

      await expectFocusWithin(modalElement);
      for (let presses = 0; presses < 4; presses++) {
        await userEvent.tab();
        await expectFocusWithin(modalElement);
      }

      await userEvent.click(
        app.getByRole("heading", { level: 2, name: "Geo Block" })
      );
      await expect.element(modal).toBeInTheDocument();
      expect(hostDialog()).not.toBeNull();

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => modalElement.isConnected).toBe(false);
      expect(hostDialog()).not.toBeNull();
      expect(onHostOpenChange).not.toHaveBeenCalledWith(false);

      await app.unmount();
      await host.unmount();
    });

    it("keeps focus, Escape and clicks inside a Select", async () => {
      const onHostOpenChange = vi.fn();
      const screen = await render(
        <HostDialog onOpenChange={onHostOpenChange}>
          <OverlayFixture />
        </HostDialog>
      );
      const trigger = screen.getByRole("combobox", { name: "Network" });

      await userEvent.click(trigger);
      const list = screen.getByRole("listbox", { name: "Network" });
      await expect.element(list).toBeVisible();
      await expectFocusWithin(list.element());
      await userEvent.keyboard("{ArrowDown}");
      await expectFocusWithin(list.element());

      await userEvent.click(screen.getByRole("option", { name: "Solana" }));
      await expect.element(list).not.toBeInTheDocument();
      await expect.element(trigger).toHaveTextContent("Solana");
      expect(hostDialog()).not.toBeNull();

      await userEvent.click(trigger);
      await expect.element(list).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(list).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
      expect(hostDialog()).not.toBeNull();
      expect(onHostOpenChange).not.toHaveBeenCalledWith(false);

      await screen.unmount();
    });

    it("keeps focus, Escape and clicks inside a Tooltip", async () => {
      const onHostOpenChange = vi.fn();
      const screen = await render(
        <HostDialog onOpenChange={onHostOpenChange}>
          <OverlayFixture />
        </HostDialog>
      );
      const trigger = screen.getByRole("button", { name: "Copy" });

      await userEvent.hover(trigger);
      const hint = screen.getByText("Copy address");
      await expect.element(hint).toBeVisible();
      // A tooltip may hide as the pointer leaves its trigger, so the press is
      // dispatched on it directly rather than moving the pointer there.
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
        hint
          .element()
          .dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0 }));
      }
      hint.element().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(hostDialog()).not.toBeNull();

      trigger.element().focus();
      await expect.element(hint).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect.element(hint).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
      expect(hostDialog()).not.toBeNull();
      expect(onHostOpenChange).not.toHaveBeenCalledWith(false);

      await screen.unmount();
    });
  }
);

describe("Widget portal container", () => {
  it("renders popups inside the Widget root by default", async ({ worker }) => {
    geoBlock(worker);
    const app = await renderApp();

    const modal = app.getByRole("dialog", { name: "Geo Block" });
    await expect.element(modal).toBeVisible();
    const root = modal.element().closest("[data-sk-root]");
    expect(root).not.toBeNull();
    expect(modal.element().closest("[data-sk-portal]")).not.toBeNull();
    expect(root === null ? null : getComputedStyle(root).isolation).toBe(
      "isolate"
    );

    await app.unmount();
  });

  it("renders popups into the host portalContainer with the Widget's theme", async ({
    worker,
  }) => {
    geoBlock(worker);
    const portalContainer = document.createElement("div");
    document.body.append(portalContainer);
    onTestFinished(() => portalContainer.remove());
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        appearance: { colors: { light: { background: "#0E7C66" } } },
        portalContainer,
      },
    });

    const modal = app.getByRole("dialog", { name: "Geo Block" });
    await expect.element(modal).toBeVisible();
    expect(modal.element().closest("[data-sk-root]")).toBeNull();
    // The Widget themes an element of its own inside the host's container and
    // leaves the host's element alone.
    const widgetPortal = portalContainer.querySelector(
      ":scope > [data-sk-portal]"
    );
    expect(widgetPortal?.contains(modal.element())).toBe(true);
    expect(widgetPortal?.classList.length).toBeGreaterThan(0);
    expect(portalContainer.hasAttribute("data-sk-portal")).toBe(false);
    expect(portalContainer.classList).toHaveLength(0);
    // The Modal paints the host's `background` role.
    expect(getComputedStyle(modal.element()).backgroundColor).toBe(
      "rgb(14, 124, 102)"
    );

    await app.unmount();
  });

  it("stacks a Select's list above the Modal it opens in", async () => {
    const screen = await render(
      <ThemeRoot
        appearance={{}}
        appearancePreset="default"
        callToActionSize="lg"
        colorScheme="light"
        gutter="md"
        surfaceStyle="filled"
        tabsIndicator="underline"
        portalContainer={undefined}
      >
        <Modal open title="Choose a network" closeLabel="Close">
          <NetworkSelect />
        </Modal>
      </ThemeRoot>
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Network" }));
    const list = screen.getByRole("listbox", { name: "Network" });
    await expect.element(list).toBeVisible();
    const option = screen.getByRole("option", { name: "Solana" }).element();
    const { left, top, width, height } = option.getBoundingClientRect();

    await expect
      .poll(() =>
        list
          .element()
          .contains(
            document.elementFromPoint(left + width / 2, top + height / 2)
          )
      )
      .toBe(true);

    await screen.unmount();
  });

  it("presents the Modal as a bottom sheet below a 520px viewport", async ({
    worker,
  }) => {
    geoBlock(worker);
    await page.viewport(400, 800);
    const app = await renderApp();

    const modal = app.getByRole("dialog", { name: "Geo Block" });
    await expect.element(modal).toBeVisible();
    await expect
      .poll(() => Math.round(modal.element().getBoundingClientRect().bottom))
      .toBe(800);
    expect(modal.element().getBoundingClientRect().width).toBe(400);

    await app.unmount();
  });
});
