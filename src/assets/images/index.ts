import { config } from "../../config";
import { MaybeDocument } from "../../utils/maybe-document";

const getImage = (name: string) => `${config.assetsUrl}/widget/${name}`;

export const images = {
  bitget: getImage("bitget.png"),
  fees: getImage("fees.png"),
  ledgerLogo: getImage("ledger-logo.svg"),
  poweredBy: getImage("powered-by.png"),
  wcLogo: getImage("wc-logo.svg"),
  whatIsDeposit: getImage("what-is-deposit.png"),
  whatIsLending: getImage("what-is-lending.png"),
  whatIsLiquidStaking: getImage("what-is-liquid-staking.png"),
  whatIsStaking: getImage("what-is-staking.png"),
};

export const preloadImages = () =>
  MaybeDocument.map(() =>
    Object.values(images).forEach((src) => {
      const img = new Image();
      img.src = src;
    })
  );
