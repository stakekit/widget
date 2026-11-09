import { useTranslation } from "react-i18next";

import type { EarnValidator } from "../../../../../../../domain/earn/validator";
import type { EarnYieldWithProvider } from "../../../../../../../domain/earn/yield-schema";
import {
  formatCompactNumber,
  formatRoundedPercent,
  unavailableFigure,
} from "../../../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../../../shared/react/widget-presentation";
import {
  Badge,
  Button,
  Card,
  Divider,
  IconButton,
  Stack,
  Text,
  TokenAvatar,
} from "../../../../../../../ui/index";

/**
 * A validator's labelled facts on one line, such as "0% commission · 76M POL
 * staked"; a fact the API does not give is left out.
 */
const useValidatorMeta = (
  validator: EarnValidator,
  selectedStake: EarnYieldWithProvider
) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const commission =
    typeof validator.commission === "number"
      ? t("details.validator_meta.commission", {
          value: formatRoundedPercent(validator.commission, locale),
        })
      : null;
  const stakedFigure = validator.tvl
    ? formatCompactNumber(validator.tvl, locale)
    : unavailableFigure;
  const staked =
    stakedFigure === unavailableFigure
      ? null
      : t("details.validator_meta.staked", {
          amount: `${stakedFigure} ${selectedStake.token.symbol}`,
        });

  return [commission, staked]
    .filter((part): part is string => part !== null)
    .join(" · ");
};

/** The chosen validators of the Compact Layout, with the controls to change them. */
export const SelectValidatorTrigger = ({
  onOpen,
  onRemoveValidator,
  multiSelect,
  selectedValidatorsArr,
  selectedStake,
}: {
  onOpen: () => void;
  onRemoveValidator: (item: EarnValidator) => void;
  multiSelect: boolean;
  selectedValidatorsArr: EarnValidator[];
  selectedStake: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();

  if (multiSelect) {
    return (
      <Stack gap={12}>
        <Stack direction="row" align="center" gap={8} wrap>
          <Text weight="semibold">{t("details.earn_with")}</Text>

          {selectedValidatorsArr.map((sv) => {
            const name = sv.name ?? sv.address;

            return (
              <Card key={sv.key} padding={4}>
                <Stack direction="row" align="center" gap={6}>
                  <TokenAvatar
                    name={name}
                    {...(sv.logoURI ? { src: sv.logoURI } : {})}
                    size="xs"
                    shape="square"
                    decorative
                  />
                  <Text weight="semibold" truncate>
                    {name}
                  </Text>
                  {sv.preferred ? (
                    <Badge
                      tone="accent"
                      icon="PreferredIcon"
                      collapse="belowSm"
                    >
                      {t("details.validators_preferred")}
                    </Badge>
                  ) : null}
                  {selectedValidatorsArr.length > 1 ? (
                    <IconButton
                      icon="XIcon"
                      size="xs"
                      label={t("details.validators_remove", { name })}
                      onClick={() => onRemoveValidator(sv)}
                    />
                  ) : null}
                </Stack>
              </Card>
            );
          })}

          <IconButton
            icon="PlusIcon"
            variant="secondary"
            label={t("shared.manage_validators")}
            testId="select-validator-plus"
            onClick={onOpen}
          />
        </Stack>

        <Divider />
      </Stack>
    );
  }

  if (!selectedValidatorsArr.length) {
    return (
      <Card padding={16}>
        <Stack direction="row" align="center" justify="between" gap={12}>
          <Text tone="muted">{t("details.validator_search_title_one")}</Text>
          <ChangeButton onClick={onOpen} />
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap={8}>
      {selectedValidatorsArr.map((sv) => (
        <SelectedValidatorCard
          key={sv.key}
          onOpen={onOpen}
          selectedStake={selectedStake}
          validator={sv}
        />
      ))}
    </Stack>
  );
};

const ChangeButton = ({ onClick }: { readonly onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      size="sm"
      iconEnd="CaretDownIcon"
      onClick={onClick}
    >
      {t("shared.change")}
    </Button>
  );
};

/**
 * The chosen validator, filled like the amount and Earn cards above it: its
 * mark and name, which keeps its room over the badges, and its labelled
 * facts under them. Only a status worth noticing (jailed, inactive) shows.
 */
const SelectedValidatorCard = ({
  onOpen,
  selectedStake,
  validator,
}: {
  readonly onOpen: () => void;
  readonly selectedStake: EarnYieldWithProvider;
  readonly validator: EarnValidator;
}) => {
  const { t } = useTranslation();
  const name = validator.name ?? validator.address;
  const meta = useValidatorMeta(validator, selectedStake);
  const getStatusBadge = () => {
    if (validator.status === "jailed") {
      return <Badge tone="warning">{t("details.validators_jailed")}</Badge>;
    }
    if (validator.status && validator.status !== "active") {
      return <Badge tone="warning">{t("details.validators_inactive")}</Badge>;
    }
    return null;
  };

  return (
    <Card padding={16}>
      <Stack direction="row" align="center" justify="between" gap={12}>
        <Stack direction="row" align="center" gap={12} grow>
          <TokenAvatar
            name={name}
            {...(validator.logoURI ? { src: validator.logoURI } : {})}
            shape="square"
            decorative
          />

          <Stack gap={2} grow>
            <Stack direction="row" align="center" gap={8}>
              <Text weight="semibold" truncate>
                {name}
              </Text>
              {validator.preferred && (
                <Badge tone="accent" icon="PreferredIcon" collapse="belowSm">
                  {t("details.validators_preferred")}
                </Badge>
              )}
              {getStatusBadge()}
            </Stack>

            {meta && (
              <Text variant="caption" tone="muted" numeric>
                {meta}
              </Text>
            )}
          </Stack>
        </Stack>

        <ChangeButton onClick={onOpen} />
      </Stack>
    </Card>
  );
};
