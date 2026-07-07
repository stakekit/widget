import { config } from "../../src/config";

const getApiRoute = (baseUrl: string, path: string) =>
  new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();

export const legacyApiRoute = (path: string) =>
  getApiRoute(config.env.apiUrl, path);

export const yieldApiRoute = (path: string) =>
  getApiRoute(config.env.yieldsApiUrl, path);

export const borrowApiRoute = (path: string) =>
  getApiRoute(config.env.borrowApiUrl, path);
