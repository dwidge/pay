export function randId(length = 7): string {
  return Math.random()
    .toString(32)
    .substring(2, 2 + length);
}
