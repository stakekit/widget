import type { TokenDto } from "@stakekit/api-hooks";

export type TokenString = `${TokenDto["network"]}-${TokenDto["address"]}`;
