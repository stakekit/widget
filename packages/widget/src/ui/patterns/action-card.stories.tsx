import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { ContainerFrame } from "../storybook/container-frame";
import { softControlSetOff } from "../storybook/painted-color";
import { ActionCard } from "./action-card";

const onClaim = fn();
const onWithdraw = fn();

const meta = {
  title: "Patterns/ActionCard",
  component: ActionCard,
  args: {
    title: (
      <>
        Claim rewards <Text.Strong>1.335 POL</Text.Strong>
      </>
    ),
    action: { label: "Claim", onClick: onClaim },
  },
  render: (args) => (
    <ContainerFrame width={400}>
      <Stack gap={8}>
        <ActionCard {...args} />
        <ActionCard
          title={
            <>
              Withdraw <Text.Strong>1 POL</Text.Strong>
            </>
          }
          description="Unstaked on Nov 3."
          action={{ label: "Withdraw", onClick: onWithdraw }}
        />
      </Stack>
    </ContainerFrame>
  ),
} satisfies Meta<typeof ActionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

const box = (element: Element | null | undefined) => {
  if (element == null) throw new Error("Expected an element.");
  return element.getBoundingClientRect();
};

/** How far a card's content sits in from its right edge: border and padding. */
const contentInset = (card: Element | null | undefined) => {
  if (card == null) throw new Error("Expected a card.");
  const style = getComputedStyle(card);
  return (
    Number.parseFloat(style.borderRightWidth) +
    Number.parseFloat(style.paddingRight)
  );
};

/**
 * Each card's button names its own verb and runs its own action; the button
 * sits at the end of the card's content, on its title's row.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const claim = canvas.getByRole("button", { name: "Claim" });
    const withdraw = canvas.getByRole("button", { name: "Withdraw" });

    await userEvent.click(claim);
    await expect(onClaim).toHaveBeenCalledTimes(1);
    await userEvent.click(withdraw);
    await expect(onWithdraw).toHaveBeenCalledTimes(1);

    for (const button of [claim, withdraw]) {
      const card = button.parentElement?.parentElement;
      await expect(box(card).right - box(button).right).toBe(
        contentInset(card)
      );
    }
    const title = canvas.getByText("Claim rewards", { exact: false });
    await expect(box(claim).top).toBeLessThan(box(title).bottom);
  },
};

export const DefaultDark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/**
 * The soft button stands off its filled card in either scheme: its tint
 * nearly matches the card's surface, so a 1px accent edge, at least 1.5:1 on
 * the card (as the contrast test holds it), bounds it.
 */
export const SetOffTheCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const name of ["Claim", "Withdraw"]) {
      const button = canvas.getByRole("button", { name });
      const card = button.parentElement?.parentElement;
      if (card == null) throw new Error("Expected the button's card.");
      const setOff = softControlSetOff(
        button,
        getComputedStyle(card).backgroundColor
      );

      await expect(setOff.fillDiffers).toBe(true);
      await expect(setOff.edgeWidth).toBe("1px");
      await expect(setOff.edgeOpaque).toBe(true);
      await expect(setOff.edgeContrast).toBeGreaterThanOrEqual(1.5);
    }
  },
};

export const SetOffTheCardDark: Story = {
  ...SetOffTheCard,
  globals: { colorScheme: "dark" },
};

/**
 * The screen's call to action: the leading card tints in the accent and its
 * button fills, while a sibling card keeps its soft button. The figure the
 * card offers can read in the success tone, as claimable amounts do.
 */
export const Primary: Story = {
  args: {
    primary: true,
    title: (
      <>
        <Text as="strong" weight="semibold" tone="success">
          1 POL
        </Text>{" "}
        ready to withdraw
      </>
    ),
    action: { label: "Withdraw", onClick: onWithdraw },
  },
  render: (args) => (
    <ContainerFrame width={400}>
      <Stack gap={8}>
        <ActionCard {...args} />
        <ActionCard
          title={
            <>
              Claim rewards <Text.Strong>1.335 POL</Text.Strong>
            </>
          }
          action={{ label: "Claim", onClick: onClaim }}
        />
      </Stack>
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const withdraw = canvas.getByRole("button", { name: "Withdraw" });
    const claim = canvas.getByRole("button", { name: "Claim" });
    const fill = (element: Element) =>
      getComputedStyle(element).backgroundColor;

    await expect(fill(withdraw)).not.toBe(fill(claim));
    await userEvent.click(withdraw);
    await expect(onWithdraw).toHaveBeenCalled();
  },
};

export const PrimaryDark: Story = {
  ...Primary,
  globals: { colorScheme: "dark" },
};

/**
 * At a narrow width the text wraps and the button keeps its row, so sibling
 * cards keep one shape.
 */
export const Narrow: Story = {
  args: {
    title: (
      <>
        Claim rewards from your validator{" "}
        <Text.Strong>1,234.5678 POL</Text.Strong>
      </>
    ),
  },
  render: (args) => (
    <ContainerFrame width={280}>
      <ActionCard {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Claim" });
    const card = button.parentElement?.parentElement;
    const title = canvas.getByText("Claim rewards", { exact: false });

    await expect(box(title).right).toBeLessThanOrEqual(box(button).left);
    await expect(box(card).right - box(button).right).toBe(contentInset(card));
  },
};

/** Tab reaches each card's button in turn, and Enter runs its action. */
export const KeyboardActivation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Claim" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(onClaim).toHaveBeenCalledTimes(1);

    await userEvent.tab();
    await expect(
      canvas.getByRole("button", { name: "Withdraw" })
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(onWithdraw).toHaveBeenCalledTimes(1);
    await expect(onClaim).toHaveBeenCalledTimes(1);
  },
};

/**
 * An action under way: its button is busy and ignores activation, and Tab
 * passes over it to the next card's button.
 */
export const Loading: Story = {
  args: { action: { label: "Claim", onClick: onClaim, loading: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const claim = canvas.getByRole("button", { name: "Claim" });

    await expect(claim).toHaveAttribute("aria-busy", "true");
    await expect(claim).toBeDisabled();

    await userEvent.tab();
    await expect(claim).not.toHaveFocus();
    await expect(
      canvas.getByRole("button", { name: "Withdraw" })
    ).toHaveFocus();

    claim.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(claim, { pointerEventsCheck: 0 });
    await expect(onClaim).not.toHaveBeenCalled();
  },
};

/**
 * An action that cannot run: its button is disabled, not busy, and Tab
 * passes over it to the next card's button.
 */
export const Disabled: Story = {
  args: { action: { label: "Claim", onClick: onClaim, disabled: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const claim = canvas.getByRole("button", { name: "Claim" });

    await expect(claim).toBeDisabled();
    await expect(claim).not.toHaveAttribute("aria-busy");

    await userEvent.tab();
    await expect(claim).not.toHaveFocus();
    await expect(
      canvas.getByRole("button", { name: "Withdraw" })
    ).toHaveFocus();

    claim.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(claim, { pointerEventsCheck: 0 });
    await expect(onClaim).not.toHaveBeenCalled();
  },
};
