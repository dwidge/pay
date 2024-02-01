export const deepFilter = <T extends Record<string, any>>(
  value: T,
  mask: T,
  cond = (mask: any, value: any) =>
    mask === value || value?.includes?.(mask) || false
): boolean =>
  typeof mask !== "object" || typeof value !== "object"
    ? false
    : Object.keys(mask).every((key) =>
        typeof mask[key] === "object"
          ? deepFilter(value[key], mask[key], cond)
          : mask[key] === undefined ||
            (key in value && cond(mask[key], value[key]))
      );
