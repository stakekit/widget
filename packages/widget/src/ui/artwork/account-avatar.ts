/*!
 * Adapted from RainbowKit.
 * MIT License
 *
 * Copyright (c) 2024 Rainbow
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * The generated avatars' palette: an account avatar's background, and the
 * stops of the gradient a fallback's initials sit on. Artwork keeps its own
 * colors, so it is exempt from the Color Role rules and never themed.
 */
export const avatarColors = [
  "#FC5C54",
  "#FFD95A",
  "#E95D72",
  "#6A87C8",
  "#5FD0F3",
  "#75C06B",
  "#FFDD86",
  "#5FC6D4",
  "#FF949A",
  "#FF8024",
  "#9BA1A4",
  "#EC66FF",
  "#FF8CBC",
  "#FF9A23",
  "#C5DADB",
  "#A8CE63",
  "#71ABFF",
  "#FFE279",
  "#B6B1B6",
  "#FF6780",
  "#A575FF",
  "#4D82FF",
  "#FFB35A",
] as const;
const avatars = [
  { color: avatarColors[0], emoji: "\u{1F336}" },
  { color: avatarColors[1], emoji: "\u{1F911}" },
  { color: avatarColors[2], emoji: "\u{1F419}" },
  { color: avatarColors[3], emoji: "\u{1FAD0}" },
  { color: avatarColors[4], emoji: "\u{1F433}" },
  { color: avatarColors[0], emoji: "\u{1F936}" },
  { color: avatarColors[5], emoji: "\u{1F332}" },
  { color: avatarColors[6], emoji: "\u{1F31E}" },
  { color: avatarColors[7], emoji: "\u{1F412}" },
  { color: avatarColors[8], emoji: "\u{1F435}" },
  { color: avatarColors[9], emoji: "\u{1F98A}" },
  { color: avatarColors[10], emoji: "\u{1F43C}" },
  { color: avatarColors[11], emoji: "\u{1F984}" },
  { color: avatarColors[12], emoji: "\u{1F437}" },
  { color: avatarColors[13], emoji: "\u{1F427}" },
  { color: avatarColors[8], emoji: "\u{1F9A9}" },
  { color: avatarColors[14], emoji: "\u{1F47D}" },
  { color: avatarColors[0], emoji: "\u{1F388}" },
  { color: avatarColors[8], emoji: "\u{1F349}" },
  { color: avatarColors[1], emoji: "\u{1F389}" },
  { color: avatarColors[15], emoji: "\u{1F432}" },
  { color: avatarColors[16], emoji: "\u{1F30E}" },
  { color: avatarColors[17], emoji: "\u{1F34A}" },
  { color: avatarColors[18], emoji: "\u{1F42D}" },
  { color: avatarColors[19], emoji: "\u{1F363}" },
  { color: avatarColors[1], emoji: "\u{1F425}" },
  { color: avatarColors[20], emoji: "\u{1F47E}" },
  { color: avatarColors[15], emoji: "\u{1F966}" },
  { color: avatarColors[0], emoji: "\u{1F479}" },
  { color: avatarColors[17], emoji: "\u{1F640}" },
  { color: avatarColors[4], emoji: "\u26F1" },
  { color: avatarColors[21], emoji: "\u26F5\uFE0F" },
  { color: avatarColors[17], emoji: "\u{1F973}" },
  { color: avatarColors[8], emoji: "\u{1F92F}" },
  { color: avatarColors[22], emoji: "\u{1F920}" },
] as const;

/** The index into a list of `length` entries that a text always gets. */
export const hashIndex = (text: string, length: number) => {
  let hash = 0;
  for (const character of text) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash % length);
};

/**
 * The account avatar an address always gets: a background color and an
 * emoji from the palette.
 */
export const accountAvatar = (address: string) =>
  avatars[hashIndex(address.toLowerCase(), avatars.length)] ?? avatars[0];
