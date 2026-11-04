import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { ValidatorInput as ValidatorDto } from "../../../../../domain/earn/validator";
import { exactDecimal } from "../../../../../domain/finance/exact";
import type { Token } from "../../../../../domain/token/token";
import { getRewardTypeFormatted } from "../../../../../shared/lib/formatters";
import { formatAddress } from "../../../../../shared/lib/general";
import {
  formatNumber,
  formatRewardRatePercent,
  formatRoundedPercent,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";

type ValidatorSubnet = NonNullable<ValidatorDto["subnet"]>;

/**
 * One fact about a validator, formatted. The address also carries its full
 * value to copy, and the website the URL it opens.
 */
type ValidatorMetaEntry = {
  readonly title: string;
  readonly val: string;
  readonly copyValue?: string;
  readonly href?: string;
};

type ValidatorMetaInput = {
  commission?: ValidatorDto["commission"];
  stakedBalance?: ValidatorDto["tvl"];
  votingPower?: ValidatorDto["votingPower"];
  address?: ValidatorDto["address"] | undefined;
  website?: ValidatorDto["website"];
  nominatorCount?: ValidatorDto["nominatorCount"];
  subnetName?: ValidatorSubnet["name"];
  marketCap?: ValidatorSubnet["tvl"];
  tokenSymbol?: ValidatorSubnet["tokenSymbol"];
  stakedBalanceToken: Token | undefined;
  rewardRate: BigNumber | number | undefined;
  rewardType: string | undefined;
};

/** A validator's facts, formatted in the Widget's language. */
export const useMetaInfo = (input: ValidatorMetaInput) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  return getValidatorMetaInfo(input, t, locale);
};

/** A validator's facts, formatted, for lists that format many at once. */
export const getValidatorMetaInfo = (
  {
    commission,
    stakedBalance,
    stakedBalanceToken,
    votingPower,
    address,
    rewardRate,
    rewardType,
    website,
    nominatorCount,
    subnetName,
    marketCap,
    tokenSymbol,
  }: ValidatorMetaInput,
  t: TFunction,
  locale: string
) => {
  const metaInfo: {
    stakedBalance: ValidatorMetaEntry | null;
    votingPower: ValidatorMetaEntry | null;
    commission: ValidatorMetaEntry | null;
    address: ValidatorMetaEntry | null;
    website: ValidatorMetaEntry | null;
    nominatorCount: ValidatorMetaEntry | null;
    subnetName: ValidatorMetaEntry | null;
    marketCap: ValidatorMetaEntry | null;
    tokenSymbol: ValidatorMetaEntry | null;
    rewardRate: ValidatorMetaEntry | null;
  } = {
    rewardRate:
      rewardRate != null && !exactDecimal(rewardRate).isZero() && rewardType
        ? {
            title: getRewardTypeFormatted(rewardType),
            val: formatRewardRatePercent(rewardRate, locale),
          }
        : null,
    stakedBalance:
      stakedBalance && stakedBalanceToken
        ? {
            title: t("details.validators_staked_balance"),
            val: formatBigNumber(
              stakedBalance,
              (value) =>
                `${formatNumber(value, locale, 0)} ${stakedBalanceToken.symbol}`
            ),
          }
        : null,
    votingPower: votingPower
      ? {
          title: t("details.validators_voting_power"),
          val: formatBigNumber(exactDecimal(votingPower), (value) =>
            formatRoundedPercent(value, locale)
          ),
        }
      : null,
    nominatorCount:
      typeof nominatorCount === "number" && Number.isInteger(nominatorCount)
        ? {
            title: t("details.validators_nominator_count"),
            val: formatNumber(nominatorCount, locale, 0),
          }
        : null,
    commission: commission
      ? {
          title: t("details.validators_comission"),
          val: formatBigNumber(exactDecimal(commission), (value) =>
            formatRoundedPercent(value, locale)
          ),
        }
      : null,
    address: address
      ? {
          title: t("details.validators_address"),
          val: formatAddress(address, { leadingChars: 8, trailingChars: 8 }),
          copyValue: address,
        }
      : null,
    website: website
      ? {
          title: t("details.validators_website"),
          val: formatAddress(website, { leadingChars: 16, trailingChars: 8 }),
          href: website,
        }
      : null,
    subnetName: subnetName
      ? {
          title: t("details.validators_subnet_name"),
          val: subnetName,
        }
      : null,
    marketCap: marketCap
      ? {
          title: t("details.validators_market_cap"),
          val: formatNumber(marketCap, locale, 2),
        }
      : null,
    tokenSymbol: tokenSymbol
      ? {
          title: t("details.validators_token_symbol"),
          val: tokenSymbol,
        }
      : null,
  };

  return metaInfo;
};

const formatBigNumber = (
  value: BigNumber,
  format: (value: BigNumber) => string
) => (value.isNaN() ? "-" : format(value));
