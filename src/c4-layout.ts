/**
 * Collapse the vertical slot left behind when a C4 person icon is removed.
 * Labels below the icon move up by its height; the stereotype above it stays.
 */
export function compactC4PersonTextY(textY: number, imageY: number, imageHeight: number): number {
  if (![textY, imageY, imageHeight].every(Number.isFinite) || imageHeight <= 0) return textY
  return textY >= imageY + imageHeight ? textY - imageHeight : textY
}
