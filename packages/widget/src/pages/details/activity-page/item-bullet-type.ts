export const ItemBulletType = {
  ALONE: "alone",
  FIRST: "first",
  MIDDLE: "middle",
  LAST: "last",
};

export type ItemBulletType =
  (typeof ItemBulletType)[keyof typeof ItemBulletType];

export const createSubArray = (val: number): ItemBulletType[] => {
  return Array.from({ length: val }, (_, i) => {
    if (val === 1) return ItemBulletType.ALONE;
    if (i === 0) return ItemBulletType.FIRST;
    if (i === val - 1) return ItemBulletType.LAST;
    return ItemBulletType.MIDDLE;
  });
};
