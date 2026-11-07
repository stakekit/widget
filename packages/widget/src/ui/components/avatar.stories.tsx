import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import {
  brokenImage,
  darkLogo,
  networkLogo,
  providerLogo,
  tokenLogo,
  walletLogo,
} from "../storybook/images";
import { Avatar, IconAvatar, TokenAvatar } from "./avatar";
import { Card } from "./card";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { label: "Lido" },
} satisfies Meta<typeof Avatar>;
export default meta;

type Story = StoryObj<typeof meta>;

const sizes = [
  "xs",
  "sm",
  "control",
  "md",
  "card",
  "lg",
  "hero",
  "xl",
] as const;

export const Image: Story = { args: { src: tokenLogo } };

/**
 * Without an image, or once it fails, the label's initials show on the
 * gradient its name always gets.
 */
export const Fallback: Story = {
  args: { src: brokenImage },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "Lido" });
    await waitFor(() => expect(avatar).toHaveTextContent(/^L$/u));
  },
};

export const FallbackDark: Story = {
  globals: { colorScheme: "dark" },
};

/**
 * A whole name stands in as one or two initials, never clipped: the first
 * letters of its first two words, past an address's `0x`, and one letter on
 * the smallest avatar.
 */
export const FallbackInitials: Story = {
  render: () => (
    <Stack gap={8}>
      {sizes.map((size) => (
        <Stack key={size} direction="row" align="center" gap={8}>
          <Avatar size={size} label="Lido" />
          <Avatar size={size} label="Morpho Blue" />
          <Avatar size={size} fallback="Dinari dShares" />
          <Avatar size={size} fallback="Ethena USDe" shape="square" />
          <Avatar size={size} fallback="0x9f8d3e2b7c1a4f6e5d0c" />
        </Stack>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getAllByRole("img", { name: "Morpho Blue" })[1]
    ).toHaveTextContent(/^MB$/u);
    await expect(
      canvas.getAllByRole("img", { name: "Morpho Blue" })[0]
    ).toHaveTextContent(/^M$/u);
    await expect(canvasElement).toHaveTextContent(/DD/u);
    await expect(canvasElement).toHaveTextContent(/EU/u);
    await expect(canvasElement).toHaveTextContent(/9$/u);
  },
};

export const FallbackInitialsDark: Story = {
  ...FallbackInitials,
  globals: { colorScheme: "dark" },
};

export const Sizes: Story = {
  render: (args) => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </Stack>
  ),
};

const logos = [
  { label: "Ether", src: tokenLogo, shape: "round" },
  { label: "Polygon", src: networkLogo, shape: "round" },
  { label: "Lido", src: providerLogo, shape: "round" },
  { label: "Dark mark", src: darkLogo, shape: "round" },
  { label: "MetaMask", src: walletLogo, shape: "square" },
] as const;

/**
 * A loaded logo shows at its full bounds, on no fill and under no ring: a
 * round one is not clipped, so a logo reaching its corners keeps them, and a
 * wallet's or a validator's only has its corners rounded. On the canvas and
 * on a card.
 */
export const Logos: Story = {
  render: () => {
    const row = (
      <Stack direction="row" align="center" gap={8}>
        {logos.map((logo) => (
          <Avatar key={logo.label} {...logo} size="lg" />
        ))}
      </Stack>
    );

    return (
      <Stack gap={12} align="start">
        {row}
        <Card padding={12}>{row}</Card>
      </Stack>
    );
  },
  play: async ({ canvasElement }) => {
    const [round] = within(canvasElement).getAllByRole("img", {
      name: "Ether",
    });
    const [square] = within(canvasElement).getAllByRole("img", {
      name: "MetaMask",
    });
    if (round === undefined || square === undefined) {
      throw new Error("Expected the logos");
    }
    for (const avatar of [round, square]) {
      await waitFor(() => expect(avatar.querySelector("img")).not.toBeNull());
      await expect(getComputedStyle(avatar).outlineStyle).toBe("none");
      // No fill: the computed color's alpha is 0.
      await expect(getComputedStyle(avatar).backgroundColor).toMatch(/, 0\)$/);
    }
    await expect(getComputedStyle(round).overflow).toBe("visible");
    await expect(getComputedStyle(square).overflow).toBe("hidden");
    await expect(
      Number.parseFloat(getComputedStyle(square).borderTopLeftRadius)
    ).toBeLessThan(square.getBoundingClientRect().width / 2);
  },
};

export const LogosDark: Story = {
  ...Logos,
  globals: { colorScheme: "dark" },
};

/**
 * A token's logo with its network badge. The logo is fitted whole and never
 * cut; the badge sits over its bottom end, inside the avatar's footprint,
 * set off the logo by its own ring in the surface color.
 */
export const Token: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <TokenAvatar
          key={size}
          size={size}
          src={tokenLogo}
          name="ETH"
          networkSrc={networkLogo}
        />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const avatars = within(canvasElement).getAllByRole("img", { name: "ETH" });
    await expect(avatars).toHaveLength(sizes.length);

    for (const avatar of avatars) {
      const footprint = avatar.parentElement;
      const badge = footprint?.lastElementChild;
      if (!(badge instanceof HTMLElement) || badge === avatar) {
        throw new Error("Expected the network's badge");
      }

      const box = avatar.getBoundingClientRect();
      const badgeBox = badge.getBoundingClientRect();
      await expect(footprint?.getBoundingClientRect()).toMatchObject({
        width: box.width,
        height: box.height,
      });
      await expect(badgeBox.left).toBeGreaterThanOrEqual(box.left);
      await expect(badgeBox.top).toBeGreaterThanOrEqual(box.top);
      await expect(badgeBox.right).toBeLessThanOrEqual(box.right);
      await expect(badgeBox.bottom).toBeLessThanOrEqual(box.bottom);
      // About two fifths of the avatar: readable, yet the logo stays in view.
      await expect(badgeBox.width).toBeGreaterThanOrEqual(box.width * 0.35);
      await expect(badgeBox.width).toBeLessThanOrEqual(box.width * 0.45);
      // The token's logo is not cut; the badge carries its own ring.
      await expect(getComputedStyle(avatar).maskImage).toBe("none");
      await expect(
        Number.parseFloat(getComputedStyle(badge).borderTopWidth)
      ).toBeGreaterThan(0);

      const logo = await waitFor(() => {
        const image = avatar.querySelector("img");
        if (image === null) throw new Error("The logo has not loaded.");
        return image;
      });
      await expect(getComputedStyle(logo).objectFit).toBe("contain");
    }
  },
};

export const TokenDark: Story = {
  ...Token,
  globals: { colorScheme: "dark" },
};

/** A network logo that fails leaves no badge, not an empty disc. */
export const TokenNetworkFails: Story = {
  render: () => (
    <TokenAvatar src={tokenLogo} name="ETH" networkSrc={brokenImage} />
  ),
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "ETH" });
    await waitFor(() =>
      expect(avatar.parentElement?.childElementCount).toBe(1)
    );
    await waitFor(() => expect(avatar.querySelector("img")).not.toBeNull());
  },
};

/** On a card, the badge's ring matches the card's surface. */
export const TokenOnCard: Story = {
  render: () => (
    <Card padding={12}>
      <Stack direction="row" align="center" gap={8}>
        <TokenAvatar src={tokenLogo} name="ETH" networkSrc={networkLogo} />
        <TokenAvatar
          src={darkLogo}
          name="Dark"
          networkSrc={networkLogo}
          size="lg"
        />
        <TokenAvatar name="Morpho Blue" networkSrc={networkLogo} size="lg" />
      </Stack>
    </Card>
  ),
};

export const TokenOnCardDark: Story = {
  ...TokenOnCard,
  globals: { colorScheme: "dark" },
};

/**
 * `badgeIcon` draws an icon as the badge in place of the network's, such as
 * an activity's direction, on a raised disc in the text color.
 */
export const TokenBadgeIcon: Story = {
  render: () => (
    <Stack gap={8}>
      {(["md", "lg", "xl"] as const).map((size) => (
        <Stack key={size} direction="row" align="center" gap={8}>
          <TokenAvatar
            size={size}
            src={tokenLogo}
            name="ETH"
            networkSrc={networkLogo}
            badgeIcon="ArrowUpIcon"
          />
          <TokenAvatar
            size={size}
            src={tokenLogo}
            name="ETH"
            badgeIcon="ArrowDownIcon"
          />
          <TokenAvatar
            size={size}
            src={tokenLogo}
            name="ETH"
            badgeIcon="GiftIcon"
          />
          <TokenAvatar
            size={size}
            src={tokenLogo}
            name="ETH"
            badgeIcon="MinusIcon"
          />
        </Stack>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const [avatar] = within(canvasElement).getAllByRole("img", {
      name: "ETH",
    });
    const token = avatar?.parentElement;
    if (token === null || token === undefined) {
      throw new Error("Expected the avatar's wrapper");
    }
    // The icon gives the network's badge no room: one image, the token's.
    await waitFor(() => expect(token.querySelectorAll("img")).toHaveLength(1));
    await expect(token.querySelector("svg")).not.toBeNull();
  },
};

export const TokenBadgeIconDark: Story = {
  ...TokenBadgeIcon,
  globals: { colorScheme: "dark" },
};

/** An icon in an avatar's disc, decorative beside the text that names it. */
export const IconInAvatar: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      <IconAvatar>
        <Icon name="ArrowUpIcon" />
      </IconAvatar>
      <IconAvatar>
        <Icon name="GiftIcon" />
      </IconAvatar>
      <IconAvatar size="lg">
        <Icon name="WalletIcon" size="lg" />
      </IconAvatar>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole("img")).toHaveLength(0);
  },
};

export const IconInAvatarDark: Story = {
  ...IconInAvatar,
  globals: { colorScheme: "dark" },
};

export const TokenFallback: Story = {
  render: () => <TokenAvatar src={brokenImage} name="USDC" />,
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "USDC" });
    await waitFor(() => expect(avatar).toHaveTextContent(/^U$/u));
  },
};

/**
 * `success` marks a finished action: a check badge in the success color, in
 * place of the network's, at the bottom end inside the avatar's footprint.
 */
export const TokenSuccess: Story = {
  render: () => (
    <TokenAvatar
      src={tokenLogo}
      name="eETH"
      networkSrc={networkLogo}
      size="hero"
      success
    />
  ),
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "eETH" });
    const token = avatar.parentElement;
    if (token === null) throw new Error("Expected the avatar's wrapper");
    // The token's logo loads; the network's gives way to the check.
    await waitFor(() =>
      expect(token.querySelector("img")?.getAttribute("src")).toBe(tokenLogo)
    );
    await expect(token.querySelectorAll("img")).toHaveLength(1);
    const badge = token.querySelector("svg")?.parentElement?.parentElement;
    if (!badge) throw new Error("Expected the success badge");
    const box = token.getBoundingClientRect();
    const badgeBox = badge.getBoundingClientRect();
    await expect(box.width).toBe(56);
    await expect(badgeBox.width).toBe(22);
    await expect(badgeBox.right).toBe(box.right);
    await expect(badgeBox.bottom).toBe(box.bottom);
  },
};

export const TokenSuccessDark: Story = {
  ...TokenSuccess,
  globals: { colorScheme: "dark" },
};

/** Beside text that names the token, the avatar stays out of the accessibility tree. */
export const TokenDecorative: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      <TokenAvatar src={brokenImage} name="USDC" decorative />
      <span>USDC</span>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("img")).toBeNull();
    await waitFor(() => expect(canvasElement).toHaveTextContent("UUSDC"));
  },
};

/** An account's generated avatar: the same address always gets the same one. */
export const Account: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <TokenAvatar
          key={size}
          size={size}
          account="0x9f8d3e2b7c1a4f6e5d0c8b7a6f5e4d3c2b1a0f9e"
          label="Your account"
        />
      ))}
    </Stack>
  ),
};

export const Accounts: Story = {
  render: () => (
    <Stack direction="row" gap={8} wrap>
      {Array.from({ length: 12 }, (_, index) => (
        <TokenAvatar key={index} account={`0x${index.toString(16)}`} />
      ))}
    </Stack>
  ),
};
