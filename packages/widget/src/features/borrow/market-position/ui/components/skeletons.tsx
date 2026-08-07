import { Box } from "../../../../../shared/ui/primitives/box";
import {
  ContentLoaderCircle,
  ContentLoaderLine,
} from "../../../../../shared/ui/primitives/content-loader";
import { positionDetailsComponentStyles as positionDetailsStyles } from "../../../../position-details/ui";
import * as styles from "../styles.css";

export const BorrowPositionActionsSkeleton = () => (
  <Box display="flex" flexDirection="column" gap="3" marginTop="3">
    <Box style={{ width: 120 }}>
      <ContentLoaderLine heightPx={16} />
    </Box>

    {[0, 1].map((index) => (
      <Box className={styles.actionCard} key={index}>
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          gap="2"
          minWidth="0"
        >
          <Box style={{ width: "55%" }}>
            <ContentLoaderLine heightPx={14} />
          </Box>
          <Box style={{ width: "85%" }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
        </Box>
        <Box style={{ width: 88 }}>
          <ContentLoaderLine heightPx={32} />
        </Box>
      </Box>
    ))}
  </Box>
);

export const BorrowPositionInfoSkeleton = () => (
  <Box display="flex" flexDirection="column" gap="4">
    <Box alignItems="center" display="flex" gap="3">
      <ContentLoaderCircle sizePx={48} />
      <Box display="flex" flex={1} flexDirection="column" gap="2" minWidth="0">
        <Box style={{ width: "45%" }}>
          <ContentLoaderLine heightPx={16} />
        </Box>
        <Box style={{ width: "70%" }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
      </Box>
    </Box>

    <Box className={positionDetailsStyles.metricGrid}>
      {[0, 1, 2, 3].map((index) => (
        <Box
          className={positionDetailsStyles.metricCard({ tone: "default" })}
          display="flex"
          flexDirection="column"
          gap="2"
          key={index}
        >
          <Box style={{ width: "70%" }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
          <Box style={{ width: "50%" }}>
            <ContentLoaderLine heightPx={18} />
          </Box>
        </Box>
      ))}
    </Box>

    <Box className={styles.ltvGauge}>
      <Box display="flex" gap="2" justifyContent="space-between">
        <Box style={{ width: 120 }}>
          <ContentLoaderLine heightPx={14} />
        </Box>
        <Box style={{ width: 48 }}>
          <ContentLoaderLine heightPx={14} />
        </Box>
      </Box>

      <ContentLoaderLine heightPx={10} />

      <Box display="flex" justifyContent="space-between">
        <Box style={{ width: 64 }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
        <Box style={{ width: 96 }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
      </Box>
    </Box>

    <Box display="flex" flexDirection="column" gap="3">
      {[0, 1, 2, 3].map((index) => (
        <Box display="flex" gap="4" justifyContent="space-between" key={index}>
          <Box style={{ width: 120 }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
          <Box style={{ width: 72 }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);
