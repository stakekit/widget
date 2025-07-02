import {
  type Networks,
  transactionGetGasForNetwork,
} from "@stakekit/api-hooks";
import { EitherAsync, List } from "purify-ts";

export const getAverageGasMode = ({ network }: { network: Networks }) =>
  EitherAsync(() => transactionGetGasForNetwork(network))
    .mapLeft(() => new Error("Get gas for network error"))
    .chain((gas) =>
      EitherAsync.liftEither(
        List.find((v) => v.name === "average", gas.modes.values).toEither(
          new Error("Average gas mode not found")
        )
      )
    );
