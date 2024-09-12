import { Box } from "@sk-widget/components";
import { useMemo } from "react";

const ListItemBullet = ({
  index,
  counts,
}: { index: number; counts: number[] }) => {
  const { isFirst, isLast } = useMemo(
    () => isFirstAndLast(index, counts),
    [index, counts]
  );
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
      <Box
        width="3"
        height="3"
        borderRadius="full"
        background="tokenSelectBackground"
      />
      <Box
        flex={1}
        width="1"
        background={isLast ? "transparent" : "tokenSelectBackground"}
      />
    </Box>
  );
};

export default ListItemBullet;

// Check if the current index is the first or last of a parent group
const isFirstAndLast = (
  childrenIndex: number,
  parentArray: number[]
): { isFirst: boolean; isLast: boolean } => {
  let currentIndex = 0;

  for (let i = 0; i < parentArray.length; i++) {
    const parentSize = parentArray[i];
    const firstIndex = currentIndex;
    const lastIndex = currentIndex + parentSize - 1;

    // Check if the childrenIndex falls within the current parent's group
    if (childrenIndex >= firstIndex && childrenIndex <= lastIndex) {
      return {
        isFirst: childrenIndex === firstIndex,
        isLast: childrenIndex === lastIndex,
      };
    }

    // Move to the next parent's group
    currentIndex += parentSize;
  }

  // If the index doesn't belong to any group, return false for both
  return { isFirst: false, isLast: false };
};
