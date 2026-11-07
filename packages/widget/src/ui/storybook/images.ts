/**
 * For stories only: inline images, so stories load without the network.
 * They look like the logos the Widget shows, in their own colors, so stories
 * show how a part frames a real logo: a full-bleed disc, a square tile, a
 * logo in the surface's own color and a dark mark on a transparent ground.
 */
const svg = (markup: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${markup}</svg>`
  )}`;

/** A round token logo, edge to edge: Ether's. */
export const tokenLogo = svg(
  '<circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#FFF"><path fill-opacity=".6" d="M16.5 4v8.87l7.5 3.35z"/><path d="M16.5 4 9 16.22l7.5-3.35z"/><path fill-opacity=".6" d="M16.5 21.97V28l7.5-10.38z"/><path d="M16.5 28v-6.03L9 17.62z"/><path fill-opacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z"/><path fill-opacity=".6" d="m9 16.22 7.5 4.35v-7.7z"/></g>'
);

/** A square network logo, a tile edge to edge. */
export const networkLogo = svg(
  '<rect width="32" height="32" fill="#8247E5"/><path d="M16 7.5 23.4 11.75v8.5L16 24.5l-7.4-4.25v-8.5Z" fill="none" stroke="#FFF" stroke-width="2.6" stroke-linejoin="round"/>'
);

/** A provider's logo on a white tile: the surface's own color in light. */
export const providerLogo = svg(
  '<rect width="32" height="32" fill="#FFF"/><path d="M16 6c3.6 4.7 6.2 8.1 6.2 11.2a6.2 6.2 0 0 1-12.4 0C9.8 14.1 12.4 10.7 16 6Z" fill="#00A3FF"/>'
);

/** A dark mark on a transparent ground, which a dark surface would swallow. */
export const darkLogo = svg(
  '<path d="M16 5 27 16 16 27 5 16Z" fill="#111113"/>'
);

/** A wallet's logo: a square tile in the wallet's color. */
export const walletLogo = svg(
  '<rect width="32" height="32" fill="#F6851B"/><rect x="7" y="10" width="18" height="13" rx="3" fill="#FFF"/><circle cx="20.5" cy="16.5" r="1.6" fill="#F6851B"/>'
);

/** An image that fails to decode, so the fallback shows. */
export const brokenImage = "data:image/png;base64,broken";
