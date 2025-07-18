import type { Networks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import type { i18n } from "i18next";
import { Just } from "purify-ts";
import { config } from "../config";
import { ItemBulletType } from "../pages/details/activity-page/state/types";
import { MaybeWindow } from "./maybe-window";

BigNumber.config({
  FORMAT: {
    prefix: "",
    decimalSeparator: ".",
    groupSeparator: ",",
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: " ",
    fractionGroupSize: 0,
    suffix: "",
  },
});

export const formatNumber = (
  number: string | BigNumber | number,
  decimals?: number
) =>
  Just(BigNumber(number))
    .map((v) =>
      decimals ? v.decimalPlaces(decimals, BigNumber.ROUND_DOWN) : v
    )
    .map((v) => v.toFormat())
    .unsafeCoerce();

export const defaultFormattedNumber = (number: string | BigNumber) =>
  formatNumber(number, 6);

export const APToPercentage = (ap: number) => (ap * 100).toFixed(2);

const colorsTuple = ["#6B69D6", "#F1C40F", "#1ABC9C", "#E74C3C"];

export const getBackgroundColor = (stringInput: string) => {
  const char = stringInput.charCodeAt(0);

  return colorsTuple[char % colorsTuple.length] ?? colorsTuple[0];
};

export const isIframe = () =>
  MaybeWindow.map((w) => w.parent !== w).orDefault(false);

export const isLedgerDappBrowserProvider = (() => {
  let state: boolean | null = null;

  return (): boolean => {
    if (typeof state === "boolean") return state;

    return MaybeWindow.map((w) => {
      try {
        const params = new URLSearchParams(w.self.location.search);

        state = !!params.get("embed");
      } catch (_error) {
        state = false;
      }

      return !!state;
    }).orDefault(false);
  };
})();

export const getNetworkLogo = (network: Networks) =>
  `${config.assetsUrl}/networks/${network}.svg`;

export const getTokenLogo = (tokenName: string) =>
  `${config.assetsUrl}/tokens/${tokenName}.svg`;

export const waitForMs = (ms: number) =>
  new Promise((res) => setTimeout(res, ms));

export const typeSafeObjectFromEntries = <
  const T extends ReadonlyArray<readonly [PropertyKey, unknown]>,
>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } => {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};

export const typeSafeObjectEntries = <T extends Record<PropertyKey, unknown>>(
  obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] => {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
};

export function formatAddress(
  address: string,
  opts?: { leadingChars: number; trailingChars: number }
): string {
  const leadingChars = opts?.leadingChars ?? 4;
  const trailingChars = opts?.trailingChars ?? 4;

  return address.length < leadingChars + trailingChars
    ? address
    : `${address.substring(0, leadingChars)}\u2026${address.substring(
        address.length - trailingChars
      )}`;
}

export const isMobile = () => {
  let mobile = false;

  const hasTouchEvent = () => {
    try {
      if (typeof window === "undefined") return false;

      document.createEvent("TouchEvent");
      return true;
    } catch (_e) {
      return false;
    }
  };

  const hasMobileUserAgent = () => {
    if (typeof window === "undefined") return false;

    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
        navigator.userAgent
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
        navigator.userAgent.substring(0, 4)
      )
    ) {
      return true;
    }

    if (hasTouchEvent()) {
      return true;
    }
    return false;
  };

  mobile = hasMobileUserAgent();

  return mobile;
};

export const bpsToAmount = (bps: BigNumber, amount: BigNumber) =>
  amount.multipliedBy(bps).dividedBy(10000);

export const bpsToPercentage = (bps: BigNumber | number) =>
  BigNumber(bps).dividedBy(100).toNumber();

export const groupDateStrings = (
  dateStrings: string[],
  i18n: i18n
): [string[], number[]] => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const formatDate = (date: Date): string =>
    date.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const labelsMap: { [key: string]: string } = {};
  const countMap: { [key: string]: number } = {};

  dateStrings.forEach((dateString) => {
    const date = new Date(dateString);
    let label: string;

    if (date.toDateString() === today.toDateString()) {
      label = "today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "yesterday";
    } else {
      label = formatDate(date);
    }

    if (countMap[label]) {
      countMap[label]++;
    } else {
      countMap[label] = 1;
      labelsMap[label] = label;
    }
  });

  const labels = Object.values(labelsMap);
  const counts = Object.values(countMap);

  return [labels, counts];
};

export const createSubArray = (val: number): ItemBulletType[] => {
  return Array.from({ length: val }, (_, i) => {
    if (val === 1) return ItemBulletType.ALONE;
    if (i === 0) return ItemBulletType.FIRST;
    if (i === val - 1) return ItemBulletType.LAST;
    return ItemBulletType.MIDDLE;
  });
};
