export function getDiamondPoints(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return [
    `${centerX},${y}`,
    `${x + width},${centerY}`,
    `${centerX},${y + height}`,
    `${x},${centerY}`,
  ].join(" ");
}
