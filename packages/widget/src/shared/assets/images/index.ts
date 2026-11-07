import { config } from "../../config/widget-defaults";

const getImage = (name: string) => `${config.assetsUrl}/widget/${name}`;

const images = {
  bitget: getImage("bitget.png"),
  ledgerLogo: getImage("ledger-logo.svg"),
  wcLogo: getImage("wc-logo.svg"),
};

export const preloadImages = () => {
  Object.values(images).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
