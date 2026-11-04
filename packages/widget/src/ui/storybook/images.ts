/**
 * For stories only: inline images, so stories load without the network.
 */
const svg = (markup: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${markup}</svg>`
  )}`;

/** A round token logo. */
export const tokenLogo = svg(
  '<circle cx="16" cy="16" r="16" opacity="0.7"/><path d="M16 4 8 16l8 5 8-5Z" opacity="0.5"/>'
);

/** A square network logo. */
export const networkLogo = svg('<rect width="32" height="32" opacity="0.4"/>');

/** An image that fails to decode, so the fallback shows. */
export const brokenImage = "data:image/png;base64,broken";
