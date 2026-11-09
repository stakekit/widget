import { hashIndex, avatarColors as palette } from "./account-avatar";

/**
 * The gradients a fallback's initials sit on: pairs of neighboring hues of
 * the generated avatars' palette, drawn from the top left.
 */
const gradients = [
  [palette[0], palette[9]],
  [palette[1], palette[13]],
  [palette[2], palette[12]],
  [palette[3], palette[20]],
  [palette[4], palette[21]],
  [palette[5], palette[7]],
  [palette[15], palette[5]],
  [palette[11], palette[20]],
  [palette[19], palette[22]],
  [palette[16], palette[3]],
  [palette[14], palette[10]],
] as const;

/**
 * The initials' ink: at least 4.9:1 on every color of the palette, so the
 * initials read on either stop of any gradient, in either color scheme.
 */
const ink = "#18181B";

/**
 * The gradient and ink a name's fallback initials always get, so a provider
 * or token without a logo keeps one look wherever it shows.
 */
export const initialsAvatar = (name: string) => {
  const [from, to] =
    gradients[hashIndex(name.trim().toLowerCase(), gradients.length)] ??
    gradients[0];

  return { gradient: `linear-gradient(135deg, ${from}, ${to})`, ink };
};
