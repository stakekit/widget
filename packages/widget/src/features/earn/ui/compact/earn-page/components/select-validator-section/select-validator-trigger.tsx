import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../../domain/earn/models";
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

const formatCommission = (commission: number | undefined, locale: string) =>
  typeof commission === "number"
    ? formatRoundedPercent(commission, locale)
    : null;

const formatValidatorTvl = (
  validator: EarnValidator,
  selectedStake: EarnYieldWithProvider,
  locale: string
) => {
  const tvl = validator.tvl;

  if (!tvl) return null;

  const formatted = formatCompactNumber(tvl, locale);

  return formatted === unavailableFigure
    ? null
    : `${formatted} ${selectedStake.token.symbol}`;
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
                    decorative
                  />
                  <Text weight="semibold" truncate>
                    {name}
                  </Text>
                  {sv.preferred ? (
                    <Badge tone="accent" icon="PreferredIcon">
                      {t("details.validators_preferred")}
                    </Badge>
                  ) : null}
                  {selectedValidatorsArr.length > 1 ? (
                    <IconButton
                      icon="XIcon"
                      size="xs"
                      label={`Remove ${name}`}
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
      <Card variant="outline" padding={12}>
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
  const { locale } = useWidgetPresentation();
  const name = validator.name ?? validator.address;
  const metaParts = [
    formatCommission(validator.commission, locale),
    formatValidatorTvl(validator, selectedStake, locale),
  ].filter((part): part is string => !!part);
  const getStatusBadge = () => {
    if (validator.status === "jailed") {
      return <Badge tone="warning">{t("details.validators_jailed")}</Badge>;
    }
    if (validator.status && validator.status !== "active") {
      return <Badge tone="warning">{t("details.validators_inactive")}</Badge>;
    }
    return (
      <Badge tone="neutral">{t("position_details.balance_type.active")}</Badge>
    );
  };

  return (
    <Card variant="outline" padding={12}>
      <Stack direction="row" align="center" justify="between" gap={12}>
        <Stack direction="row" align="center" gap={12} grow>
          <TokenAvatar
            name={name}
            {...(validator.logoURI ? { src: validator.logoURI } : {})}
            decorative
          />

          <Stack gap={2} grow>
            <Stack direction="row" align="center" gap={8}>
              <Text weight="semibold" truncate>
                {name}
              </Text>
              {validator.preferred && (
                <Badge tone="accent" icon="PreferredIcon">
                  {t("details.validators_preferred")}
                </Badge>
              )}
            </Stack>

            <Stack direction="row" align="center" gap={6} wrap>
              {metaParts.length > 0 && (
                <Text variant="caption" tone="muted" numeric>
                  {metaParts.join(" · ")}
                </Text>
              )}
              {getStatusBadge()}
            </Stack>
          </Stack>
        </Stack>

        <ChangeButton onClick={onOpen} />
      </Stack>
    </Card>
  );
};
