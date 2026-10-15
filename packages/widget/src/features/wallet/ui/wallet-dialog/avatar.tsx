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

import clsx from "clsx";
import { avatarStyle } from "./avatar.css";

const colors = [
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
];
const avatars = [
  { color: colors[0], emoji: "\u{1F336}" },
  { color: colors[1], emoji: "\u{1F911}" },
  { color: colors[2], emoji: "\u{1F419}" },
  { color: colors[3], emoji: "\u{1FAD0}" },
  { color: colors[4], emoji: "\u{1F433}" },
  { color: colors[0], emoji: "\u{1F936}" },
  { color: colors[5], emoji: "\u{1F332}" },
  { color: colors[6], emoji: "\u{1F31E}" },
  { color: colors[7], emoji: "\u{1F412}" },
  { color: colors[8], emoji: "\u{1F435}" },
  { color: colors[9], emoji: "\u{1F98A}" },
  { color: colors[10], emoji: "\u{1F43C}" },
  { color: colors[11], emoji: "\u{1F984}" },
  { color: colors[12], emoji: "\u{1F437}" },
  { color: colors[13], emoji: "\u{1F427}" },
  { color: colors[8], emoji: "\u{1F9A9}" },
  { color: colors[14], emoji: "\u{1F47D}" },
  { color: colors[0], emoji: "\u{1F388}" },
  { color: colors[8], emoji: "\u{1F349}" },
  { color: colors[1], emoji: "\u{1F389}" },
  { color: colors[15], emoji: "\u{1F432}" },
  { color: colors[16], emoji: "\u{1F30E}" },
  { color: colors[17], emoji: "\u{1F34A}" },
  { color: colors[18], emoji: "\u{1F42D}" },
  { color: colors[19], emoji: "\u{1F363}" },
  { color: colors[1], emoji: "\u{1F425}" },
  { color: colors[20], emoji: "\u{1F47E}" },
  { color: colors[15], emoji: "\u{1F966}" },
  { color: colors[0], emoji: "\u{1F479}" },
  { color: colors[17], emoji: "\u{1F640}" },
  { color: colors[4], emoji: "\u26F1" },
  { color: colors[21], emoji: "\u26F5\uFE0F" },
  { color: colors[17], emoji: "\u{1F973}" },
  { color: colors[8], emoji: "\u{1F92F}" },
  { color: colors[22], emoji: "\u{1F920}" },
] as const;

export const WalletAvatar = ({
  address,
  className,
}: {
  readonly address: string;
  readonly className?: string;
}) => {
  let hash = 0;
  for (const character of address.toLowerCase()) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }
  const avatar = avatars[Math.abs(hash % avatars.length)] ?? avatars[0];

  return (
    <span
      aria-hidden="true"
      className={clsx(avatarStyle, className)}
      style={{ backgroundColor: avatar.color }}
    >
      {avatar.emoji}
    </span>
  );
};
