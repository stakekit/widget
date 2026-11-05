import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Stake", onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

const variants = [
  "primary",
  "secondary",
  "ghost",
  "danger",
  "dangerOutline",
] as const;
const sizes = ["sm", "md", "lg", "cta"] as const;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = {
  args: { variant: "danger", children: "Unstake" },
};

/**
 * `dangerOutline` draws a secondary button's label and edge in the danger
 * color, for a destructive action beside a secondary one.
 */
export const DangerOutline: Story = {
  args: { variant: "dangerOutline", children: "Disconnect" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Disconnect",
    });
    const style = getComputedStyle(button);
    await expect(style.borderTopColor).toBe(style.color);
  },
};

export const DangerOutlineDark: Story = {
  ...DangerOutline,
  globals: { colorScheme: "dark" },
};

const sharedRow = (width: number, testId: string) => (
  <div
    data-testid={testId}
    style={{ display: "flex", flexWrap: "wrap", gap: 8, width }}
  >
    <Button share>View on explorer</Button>
    <Button share variant="dangerOutline">
      Disconnect
    </Button>
  </div>
);

/**
 * `share` splits a wrapping row equally between actions whose labels fit
 * side by side; otherwise each takes its own full-width line.
 */
export const SharedRow: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      {sharedRow(360, "wide")}
      {sharedRow(200, "narrow")}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = (testId: string) =>
      within(canvas.getByTestId(testId))
        .getAllByRole("button")
        .map((button) => button.getBoundingClientRect());

    const [wideFirst, wideSecond] = boxes("wide");
    await expect(wideFirst?.top).toBe(wideSecond?.top);
    await expect(wideFirst?.width).toBe(wideSecond?.width);

    const [narrowFirst, narrowSecond] = boxes("narrow");
    await expect(narrowSecond?.top).toBeGreaterThan(narrowFirst?.top ?? 0);
    await expect(narrowFirst?.width).toBe(200);
    await expect(narrowSecond?.width).toBe(200);
  },
};

/** Every variant at every size. */
export const VariantsAndSizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 12 }}>
      {variants.map((variant) => (
        <div
          key={variant}
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          {sizes.map((size) => (
            <Button key={size} {...args} variant={variant} size={size}>
              {`${variant} ${size}`}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const VariantsAndSizesDark: Story = {
  ...VariantsAndSizes,
  globals: { colorScheme: "dark" },
};

/** Icons sit before or after the label and stay out of its name. */
export const WithIcons: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {sizes.map((size) => (
        <Button
          key={size}
          {...args}
          size={size}
          iconStart="PlusIcon"
          iconEnd="CaretDownIcon"
        >
          {`Stake ${size}`}
        </Button>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Stake md" })
    ).toBeInTheDocument();
  },
};

/** The `cta` size fills the width at the call-to-action height setting. */
export const CallToAction: Story = {
  args: { variant: "primary", size: "cta" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Stake" });
    await expect(getComputedStyle(button).height).toBe("48px");
  },
};

/** Tab reaches the button; Enter and Space activate it. */
export const KeyboardActivation: Story = {
  args: { variant: "primary" },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Stake" });

    await userEvent.tab();
    await expect(button).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

/** Every variant disabled: unreachable by Tab, and a click does nothing. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div style={{ display: "flex", gap: 12 }}>
      {variants.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");

    await userEvent.tab();
    for (const button of buttons) {
      await expect(button).toBeDisabled();
      await expect(button).not.toHaveFocus();
      await userEvent.click(button, { pointerEventsCheck: 0 });
    }
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

/**
 * A disabled button keeps its variant's look, faded: a disabled primary still
 * reads as the primary action, not as a card or a secondary button.
 */
export const DisabledLook: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12 }}>
      <Button {...args} variant="primary">
        Enabled
      </Button>
      <Button {...args} variant="primary" disabled>
        Disabled
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const enabled = getComputedStyle(
      canvas.getByRole("button", { name: "Enabled" })
    );
    const disabled = getComputedStyle(
      canvas.getByRole("button", { name: "Disabled" })
    );

    await expect(disabled.backgroundColor).toBe(enabled.backgroundColor);
    await expect(Number(disabled.opacity)).toBeLessThan(0.5);
    await expect(Number(enabled.opacity)).toBe(1);
  },
};

/** A loading button is busy, shows a spinner and ignores activation. */
export const Loading: Story = {
  args: { variant: "primary", loading: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Stake" });

    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toBeDisabled();

    await userEvent.click(button, { pointerEventsCheck: 0 });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

/** A test id renders as the button's `data-testid`. */
export const TestId: Story = {
  args: { testId: "primary-action" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByTestId("primary-action")
    ).toHaveRole("button");
  },
};

/** A host hook renders as the button's `data-rk`, which hosts locate it by. */
export const HostHook: Story = {
  args: { hostHook: "footer-button-primary", variant: "primary" },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-rk="footer-button-primary"]')
    ).toHaveRole("button");
  },
};
