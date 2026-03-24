import type {
  AddressesDto,
  ActionDto as LegacyActionDto,
  TokenDto as LegacyTokenDto,
  TransactionDto as LegacyTransactionDto,
  ValidatorDto as LegacyValidatorDto,
  YieldDto as LegacyYieldDto,
} from "@stakekit/api-hooks";
import type {
  YieldActionDto,
  YieldDto,
  YieldTokenDto,
  YieldTransactionDto,
  YieldValidatorDto,
} from "./types";

const NATIVE_TOKEN_PLACEHOLDER = "0x";

const toLower = (value: string) => value.toLowerCase();

type EncodedGasEstimate = {
  amount?: string | null;
  gasLimit?: string | null;
  token?: YieldTokenDto | LegacyTokenDto | null;
};

const mapToken = (
  token: YieldTokenDto | LegacyTokenDto | null | undefined
): LegacyTokenDto | undefined => {
  if (!token) return undefined;

  return { ...token } as LegacyTokenDto;
};

const uniqTokens = (
  tokens: (YieldTokenDto | LegacyTokenDto | null | undefined)[]
) => {
  const seen = new Set<string>();

  return tokens.flatMap((token) => {
    const mapped = mapToken(token);

    if (!mapped) return [];

    const key = `${mapped.network}:${mapped.address?.toLowerCase() ?? ""}:${
      mapped.symbol
    }`;

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [mapped];
  });
};

const secondsToDays = (seconds: number | undefined) => {
  if (seconds === undefined) return undefined;

  return { days: Math.round(seconds / 86400) };
};

const getRewardType = ({
  yieldDto,
  legacyYieldDto,
}: {
  yieldDto: YieldDto;
  legacyYieldDto: LegacyYieldDto | null;
}): LegacyYieldDto["rewardType"] => {
  const rateType = yieldDto.rewardRate?.rateType?.toLowerCase();

  if (rateType === "apr" || rateType === "apy") {
    return rateType;
  }

  return legacyYieldDto?.rewardType ?? "variable";
};

const getArgumentConfig = (
  yieldDto: YieldDto,
  legacyYieldDto: LegacyYieldDto | null,
  type: "enter" | "exit"
) => {
  const fields = yieldDto.mechanics?.arguments?.[type]?.fields ?? [];
  const legacyArgs = legacyYieldDto?.args?.[type]?.args ?? {};
  const nextArgs = { ...legacyArgs } as Record<string, unknown>;

  for (const field of fields) {
    const legacyField = (legacyArgs as Record<string, unknown>)[field.name];
    const common = {
      required: !!field.required,
      ...(field.minimum !== undefined && field.minimum !== null
        ? { minimum: Number(field.minimum) }
        : {}),
      ...(field.maximum !== undefined && field.maximum !== null
        ? { maximum: Number(field.maximum) }
        : {}),
      ...(field.options ? { options: field.options } : {}),
    };

    nextArgs[field.name] =
      legacyField &&
      typeof legacyField === "object" &&
      !Array.isArray(legacyField)
        ? {
            ...legacyField,
            ...common,
          }
        : common;
  }

  return {
    ...(legacyYieldDto?.args?.[type] ?? {}),
    args: nextArgs,
  };
};

const getRewardTokens = ({
  yieldDto,
  legacyYieldDto,
}: {
  yieldDto: YieldDto;
  legacyYieldDto: LegacyYieldDto | null;
}) => {
  if (legacyYieldDto?.metadata.rewardTokens?.length) {
    return legacyYieldDto.metadata.rewardTokens;
  }

  const seen = new Set<string>();
  const derived = uniqTokens(
    yieldDto.rewardRate?.components?.map((component) => component.token) ?? []
  ).filter((token) => {
    const key = `${token.network}:${token.address?.toLowerCase() ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  if (derived.length) {
    return derived;
  }

  return legacyYieldDto?.metadata.rewardTokens;
};

const getMetadata = ({
  yieldDto,
  legacyYieldDto,
}: {
  yieldDto: YieldDto;
  legacyYieldDto: LegacyYieldDto | null;
}): LegacyYieldDto["metadata"] => {
  const fallbackMetadata = legacyYieldDto?.metadata;
  const mechanics = yieldDto.mechanics;
  const metadata = yieldDto.metadata;
  const yieldTypeMap = {
    staking: "staking",
    restaking: "restaking",
    lending: "lending",
    vault: "vault",
    liquidity_pool: "vault",
    concentrated_liquidity_pool: "vault",
    fixed_yield: "vault",
    real_world_asset: "vault",
  } as const;
  const type =
    yieldTypeMap[(mechanics?.type ?? "vault") as keyof typeof yieldTypeMap] ??
    "vault";

  const token = mapToken(yieldDto.token) ?? fallbackMetadata?.token;
  const tokens = uniqTokens([
    ...(yieldDto.tokens ?? []),
    ...(yieldDto.inputTokens ?? []),
    ...(fallbackMetadata?.tokens ?? []),
  ]);
  const gasFeeToken =
    mapToken(mechanics?.gasFeeToken) ?? fallbackMetadata?.gasFeeToken;

  return {
    ...(fallbackMetadata ?? {}),
    name: metadata?.name ?? fallbackMetadata?.name ?? "",
    description: metadata?.description ?? fallbackMetadata?.description ?? "",
    documentation:
      metadata?.documentation ?? fallbackMetadata?.documentation ?? "",
    logoURI: metadata?.logoURI ?? fallbackMetadata?.logoURI ?? "",
    type,
    token:
      token ??
      fallbackMetadata?.token ??
      (mapToken(yieldDto.token) as LegacyTokenDto),
    tokens: tokens.length ? tokens : fallbackMetadata?.tokens,
    rewardTokens: getRewardTokens({ yieldDto, legacyYieldDto }),
    rewardSchedule:
      mechanics?.rewardSchedule ?? fallbackMetadata?.rewardSchedule,
    rewardClaiming:
      mechanics?.rewardClaiming ?? fallbackMetadata?.rewardClaiming,
    cooldownPeriod:
      secondsToDays(mechanics?.cooldownPeriod?.seconds) ??
      fallbackMetadata?.cooldownPeriod,
    warmupPeriod:
      secondsToDays(mechanics?.warmupPeriod?.seconds) ??
      fallbackMetadata?.warmupPeriod,
    gasFeeToken:
      gasFeeToken ??
      fallbackMetadata?.gasFeeToken ??
      (mapToken(yieldDto.token) as LegacyTokenDto),
    supportsLedgerWalletApi:
      mechanics?.supportsLedgerWalletApi ??
      fallbackMetadata?.supportsLedgerWalletApi,
    supportsMultipleValidators:
      mechanics?.requiresValidatorSelection ??
      fallbackMetadata?.supportsMultipleValidators,
    supportedStandards:
      metadata?.supportedStandards ?? fallbackMetadata?.supportedStandards,
    fee: {
      enabled: !!mechanics?.fee || !!fallbackMetadata?.fee?.enabled,
      depositFee:
        !!mechanics?.fee?.deposit || !!fallbackMetadata?.fee?.depositFee,
      managementFee:
        !!mechanics?.fee?.management || !!fallbackMetadata?.fee?.managementFee,
      performanceFee:
        !!mechanics?.fee?.performance ||
        !!fallbackMetadata?.fee?.performanceFee,
    },
  } as LegacyYieldDto["metadata"];
};

export const adaptValidatorDto = (
  validatorDto: YieldValidatorDto | LegacyValidatorDto
): LegacyValidatorDto => {
  const legacyValidator = validatorDto as LegacyValidatorDto;
  const rewardRate =
    "rewardRate" in validatorDto ? validatorDto.rewardRate : undefined;
  const providerId =
    "provider" in validatorDto
      ? (validatorDto.provider?.id ?? validatorDto.providerId)
      : validatorDto.providerId;
  const image =
    "logoURI" in validatorDto ? validatorDto.logoURI : legacyValidator.image;
  const stakedBalance =
    "tvl" in validatorDto ? validatorDto.tvl : legacyValidator.stakedBalance;

  return {
    address: validatorDto.address,
    apr: "apr" in validatorDto ? validatorDto.apr : rewardRate?.total,
    commission: validatorDto.commission,
    image,
    minimumStake: validatorDto.minimumStake,
    name: validatorDto.name,
    nominatorCount: validatorDto.nominatorCount,
    preferred: validatorDto.preferred,
    pricePerShare: validatorDto.pricePerShare,
    providerId,
    remainingPossibleStake: validatorDto.remainingPossibleStake,
    remainingSlots: validatorDto.remainingSlots,
    stakedBalance,
    status: validatorDto.status as LegacyValidatorDto["status"],
    subnetId: validatorDto.subnetId,
    subnetName:
      "subnetName" in validatorDto ? validatorDto.subnetName : undefined,
    tokenSymbol: validatorDto.tokenSymbol,
    votingPower: validatorDto.votingPower,
    website: validatorDto.website,
  };
};

export const adaptYieldDto = ({
  yieldDto,
  legacyYieldDto,
}: {
  yieldDto: YieldDto;
  legacyYieldDto: LegacyYieldDto | null;
}): LegacyYieldDto => {
  const { validators: _legacyValidators, ...legacyYieldDtoWithoutValidators } =
    legacyYieldDto ?? {};
  const rewardRate =
    yieldDto.rewardRate?.total ?? legacyYieldDto?.rewardRate ?? 0;
  const tokens = uniqTokens([
    ...(yieldDto.tokens ?? []),
    ...(yieldDto.inputTokens ?? []),
    ...(legacyYieldDto?.tokens ?? []),
  ]);

  const token =
    mapToken(yieldDto.token) ??
    legacyYieldDto?.token ??
    (tokens[0] as LegacyTokenDto);

  return {
    ...legacyYieldDtoWithoutValidators,
    id: yieldDto.id,
    token,
    tokens: tokens.length ? tokens : (legacyYieldDto?.tokens ?? [token]),
    metadata: getMetadata({ yieldDto, legacyYieldDto }),
    rewardRate,
    rewardRateDetails: yieldDto.rewardRate,
    rewardType: getRewardType({ yieldDto, legacyYieldDto }),
    status: {
      ...(legacyYieldDto?.status ?? {}),
      ...(yieldDto.status ?? {}),
    },
    args: {
      ...(legacyYieldDto?.args ?? {}),
      enter: getArgumentConfig(yieldDto, legacyYieldDto, "enter"),
      ...(yieldDto.mechanics?.arguments?.exit || legacyYieldDto?.args?.exit
        ? {
            exit: getArgumentConfig(yieldDto, legacyYieldDto, "exit"),
          }
        : {}),
    } as LegacyYieldDto["args"],
    feeConfigurations: legacyYieldDto?.feeConfigurations ?? [],
    apy: rewardRate,
    inputTokens: yieldDto.inputTokens,
    outputToken: yieldDto.outputToken,
    network: yieldDto.network,
    chainId: yieldDto.chainId,
    mechanics: yieldDto.mechanics,
    statistics: yieldDto.statistics,
    risk: yieldDto.risk,
    providerId: yieldDto.providerId,
    tags: yieldDto.tags,
    state: yieldDto.state,
    curator: yieldDto.curator,
  } as unknown as LegacyYieldDto;
};

const getCurrentStepIndex = (transactions: LegacyTransactionDto[]) => {
  const idx = transactions.findIndex(
    (transaction) =>
      transaction.status !== "CONFIRMED" && transaction.status !== "SKIPPED"
  );

  if (idx >= 0) {
    return idx;
  }

  return Math.max(transactions.length - 1, 0);
};

export const toActionInputToken = ({
  inputToken,
  yieldDto,
  inputTokenValue,
}: {
  inputToken?: LegacyTokenDto;
  yieldDto?: LegacyYieldDto | null;
  inputTokenValue?: string | null;
}) => {
  if (inputToken) {
    return inputToken;
  }

  if (!yieldDto) {
    return undefined;
  }

  if (!inputTokenValue) {
    return yieldDto.token ?? yieldDto.tokens?.[0];
  }

  const needle = toLower(inputTokenValue);

  return (
    [
      yieldDto.token,
      ...(yieldDto.tokens ?? []),
      ...(yieldDto.metadata.tokens ?? []),
    ].find((token) => {
      const address = token.address ? toLower(token.address) : null;
      return (
        address === needle ||
        token.symbol.toLowerCase() === needle ||
        (needle === NATIVE_TOKEN_PLACEHOLDER && !token.address)
      );
    }) ??
    yieldDto.token ??
    yieldDto.tokens?.[0]
  );
};

export const adaptTransactionDto = ({
  transactionDto,
  gasFeeToken,
  stakeId,
}: {
  transactionDto: YieldTransactionDto;
  gasFeeToken?: LegacyTokenDto;
  stakeId: string;
}): LegacyTransactionDto => ({
  id: transactionDto.id,
  accountAddresses: undefined,
  annotatedTransaction: (transactionDto.annotatedTransaction ??
    {}) as unknown as LegacyTransactionDto["annotatedTransaction"],
  broadcastedAt: transactionDto.broadcastedAt,
  createdAt: transactionDto.createdAt,
  error: transactionDto.error ?? null,
  explorerUrl: transactionDto.explorerUrl ?? null,
  gasEstimate: parseGasEstimate(transactionDto.gasEstimate, gasFeeToken),
  hash: transactionDto.hash,
  isMessage: transactionDto.isMessage ?? false,
  ledgerHwAppId: null,
  network: transactionDto.network as LegacyTransactionDto["network"],
  signedTransaction: transactionDto.signedTransaction,
  stakeId,
  status: transactionDto.status as LegacyTransactionDto["status"],
  stepIndex: transactionDto.stepIndex ?? 0,
  structuredTransaction: (transactionDto.structuredTransaction ??
    {}) as unknown as LegacyTransactionDto["structuredTransaction"],
  type: transactionDto.type as LegacyTransactionDto["type"],
  unsignedTransaction:
    typeof transactionDto.unsignedTransaction === "string"
      ? transactionDto.unsignedTransaction
      : transactionDto.unsignedTransaction
        ? JSON.stringify(transactionDto.unsignedTransaction)
        : null,
});

const parseGasEstimate = (
  gasEstimate: YieldTransactionDto["gasEstimate"],
  gasFeeToken?: LegacyTokenDto
): LegacyTransactionDto["gasEstimate"] => {
  if (!gasEstimate) {
    return null;
  }

  try {
    const parsed = JSON.parse(gasEstimate) as EncodedGasEstimate | null;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (!gasFeeToken) {
        return null;
      }

      return {
        amount: gasEstimate,
        token: gasFeeToken,
      };
    }

    const amount = parsed.amount ?? null;
    const token = mapToken(parsed.token) ?? gasFeeToken;

    if (!amount || !token) {
      return null;
    }

    return {
      amount,
      token,
      ...(parsed.gasLimit ? { gasLimit: parsed.gasLimit } : {}),
    };
  } catch {
    if (!gasFeeToken) {
      return null;
    }

    return {
      amount: gasEstimate,
      token: gasFeeToken,
    };
  }
};

export const adaptActionDto = ({
  actionDto,
  addresses,
  gasFeeToken,
  inputToken,
  yieldDto,
}: {
  actionDto: YieldActionDto;
  addresses?: AddressesDto;
  gasFeeToken?: LegacyTokenDto;
  inputToken?: LegacyTokenDto;
  yieldDto?: LegacyYieldDto | null;
}): LegacyActionDto => {
  const adaptedTransactions = actionDto.transactions.map((transactionDto) =>
    adaptTransactionDto({
      transactionDto,
      gasFeeToken:
        gasFeeToken ?? yieldDto?.metadata.gasFeeToken ?? yieldDto?.token,
      stakeId: actionDto.yieldId,
    })
  );

  const rawArguments = actionDto.rawArguments;
  const validatorAddresses =
    rawArguments?.validatorAddresses ??
    (rawArguments?.validatorAddress ? [rawArguments.validatorAddress] : null);

  return {
    id: actionDto.id,
    accountAddresses: undefined,
    addresses: addresses ?? { address: actionDto.address },
    amount: actionDto.amount,
    completedAt: actionDto.completedAt,
    createdAt: actionDto.createdAt,
    currentStepIndex: getCurrentStepIndex(adaptedTransactions),
    inputToken: toActionInputToken({
      inputToken,
      yieldDto,
      inputTokenValue: rawArguments?.inputToken,
    }),
    integrationId: actionDto.yieldId,
    projectId: null,
    status: actionDto.status,
    tokenId: rawArguments?.tokenId ?? null,
    transactions: adaptedTransactions,
    type: actionDto.type as LegacyActionDto["type"],
    USDAmount: actionDto.amountUsd,
    validatorAddress: rawArguments?.validatorAddress ?? null,
    validatorAddresses,
  };
};
