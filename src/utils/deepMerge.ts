export const deepMerge = <T extends Record<string, any>>(
  value: T,
  mask: T
): T =>
  typeof value !== "object" || typeof mask !== "object"
    ? mask
    : {
        ...value,
        ...mask,
        ...(Object.keys(mask) as (keyof T)[]).reduce(
          (acc, key) => ({
            ...acc,
            [key]: deepMerge(value[key], mask[key]!),
          }),
          {} as Partial<T>
        ),
      };
