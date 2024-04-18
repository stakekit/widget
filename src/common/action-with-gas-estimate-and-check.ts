import type {
  ActionDto,
  AddressWithTokenDto,
  GasModeValueDto,
  TokenDto,
  useActionGetGasEstimateHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
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
  gasFeeToken,
  transactionConstruct,
  tokenGetTokenBalances,
  gasEstimate,
}: {
  gasFeeToken: TokenDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  addressWithTokenDto: AddressWithTokenDto;
  actionDto: ActionDto;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
  gasEstimate: ReturnType<typeof useActionGetGasEstimateHook>;
}) =>
  addGasEstimateToTxs({ actionDto, gasEstimate })
    .chainLeft(() =>
      constructTxs({
        actionDto,
        gasModeValue,
        isLedgerLive,
        gasFeeToken,
        transactionConstruct,
      })
    )
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
            tokenGetTokenBalances,
          })
        )
        .map((gasCheckErr) => ({ actionDto, gasCheckErr }))
    );
