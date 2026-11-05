import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { brokenImage, networkLogo, tokenLogo } from "../storybook/images";
import { Avatar, IconAvatar, TokenAvatar } from "./avatar";

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

/** Without an image, or when it fails, the label's initial shows. */
export const Fallback: Story = {
  args: { src: brokenImage },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "Lido" });
    await expect(avatar).toHaveTextContent("L");
  },
};

export const FallbackDark: Story = {
  globals: { colorScheme: "dark" },
};

export const FallbackText: Story = {
  args: { label: "Ethereum", fallback: "ETH" },
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

/**
 * A token's logo with its network badge. The logo is fitted whole, never
 * cropped, and the badge sits inside the avatar's footprint at its bottom end.
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
      await expect(badge).not.toBe(avatar);

      const box = avatar.getBoundingClientRect();
      const badgeBox = badge?.getBoundingClientRect();
      await expect(footprint?.getBoundingClientRect()).toMatchObject({
        width: box.width,
        height: box.height,
      });
      await expect(badgeBox?.left).toBeGreaterThanOrEqual(box.left);
      await expect(badgeBox?.top).toBeGreaterThanOrEqual(box.top);
      await expect(badgeBox?.right).toBeLessThanOrEqual(box.right);
      await expect(badgeBox?.bottom).toBeLessThanOrEqual(box.bottom);
      // About two fifths of the avatar: readable, yet the logo stays in view.
      await expect(badgeBox?.width).toBeGreaterThanOrEqual(box.width * 0.35);
      await expect(badgeBox?.width).toBeLessThanOrEqual(box.width * 0.45);

      const logo = await waitFor(() => {
        const image = avatar.querySelector("img");
        if (image === null) throw new Error("The logo has not loaded.");
        return image;
      });
      await expect(getComputedStyle(logo).objectFit).toBe("contain");
    }
  },
};

/** An icon in an avatar's circle, decorative beside the text that names it. */
export const IconInAvatar: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      <IconAvatar>
        <Icon name="ArrowIcon" direction="up" />
      </IconAvatar>
      <IconAvatar>
        <Icon name="GiftIcon" />
      </IconAvatar>
      <IconAvatar size="lg">
        <Icon name="MinusIcon" size="lg" />
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
    await expect(
      within(canvasElement).getByRole("img", { name: "USDC" })
    ).toHaveTextContent("U");
  },
};

export const TokenDark: Story = {
  ...Token,
  globals: { colorScheme: "dark" },
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
    await expect(canvasElement).toHaveTextContent("UUSDC");
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
