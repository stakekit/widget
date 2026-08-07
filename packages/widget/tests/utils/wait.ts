export const waitForMs = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
