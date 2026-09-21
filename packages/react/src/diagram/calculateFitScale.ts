export interface CalculateFitScaleOptions {
  containerWidth: number;
  contentWidth: number;
  minZoom: number;
  maxZoom: number;
}

export function calculateFitScale({
  containerWidth,
  contentWidth,
  minZoom,
  maxZoom,
}: CalculateFitScaleOptions): number {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(contentWidth) ||
    containerWidth <= 0 ||
    contentWidth <= 0
  ) {
    return 1;
  }

  return Math.min(maxZoom, Math.max(minZoom, containerWidth / contentWidth));
}
