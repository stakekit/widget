import {
  ActionDto,
  AddressWithTokenDto,
  GasModeValueDto,
} from "@stakekit/api-hooks";
import { addGasEstimateToTxs } from "./add-gas-estimate-to-txs";
import { constructTxs } from "./construct-txs";
import { EitherAsync, Maybe } from "purify-ts";
import { checkGasAmount } from "./check-gas-amount";

export const actionWithGasEstimateAndCheck = ({
  actionDto,
  addressWithTokenDto,
  disableGasCheck,
  gasModeValue,
  isLedgerLive,
}: {
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  addressWithTokenDto: AddressWithTokenDto;
  actionDto: ActionDto;
}) =>
  addGasEstimateToTxs(actionDto)
    .chainLeft(() => constructTxs({ actionDto, gasModeValue, isLedgerLive }))
    .chain((actionDto) =>
      EitherAsync.liftEither(
        Maybe.fromFalsy(disableGasCheck)
          .map(() => null)
          .toEither(null)
      )
        .chainLeft(() =>
          checkGasAmount({
            addressWithTokenDto: addressWithTokenDto,
            txs: actionDto.transactions,
          })
        )
        .map((gasCheckErr) => ({ actionDto, gasCheckErr }))
    );
