import { Box } from "@sk-widget/components/atoms/box";
import { UtilaFailIcon } from "@sk-widget/components/atoms/icons/utila/fail";
import { UtilaSuccessIcon } from "@sk-widget/components/atoms/icons/utila/success";
import { useSettings } from "@sk-widget/providers/settings";
import { ActionStatus } from "@stakekit/api-hooks";
import { Just, Nothing } from "purify-ts";

const ListItemBullet = ({
  isFirst,
  isLast,
  status,
}: {
  isFirst: boolean;
  isLast: boolean;
  status: ActionStatus;
}) => {
  const { variant } = useSettings();

  const content = Just(variant)
    .filter((v) => v === "utila")
    .chain(() => {
      if (status === ActionStatus.SUCCESS) {
        return Just(<UtilaSuccessIcon />);
      }

      if (status === ActionStatus.FAILED) {
        return Just(<UtilaFailIcon />);
      }

      return Nothing;
    })
    .altLazy(() =>
      Just(
        <Box
          width="3"
          height="3"
          borderRadius="full"
          background="tokenSelectBackground"
        />
      )
    )
    .extractNullable();

  return (
    <Box
      flex={1}
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="1"
    >
      <Box
        flex={1}
        width="1"
        background={isFirst ? "transparent" : "tokenSelectBackground"}
      />
      {content}
      <Box
        flex={1}
        width="1"
        background={isLast ? "transparent" : "tokenSelectBackground"}
      />
    </Box>
  );
};

export default ListItemBullet;
