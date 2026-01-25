export const POSITION_GAP = 1000
export const MIN_GAP = 10

interface Positioned {
  position: number
}

/**
 * Calculate the new position for an item being inserted at a given index.
 * - If list is empty, returns POSITION_GAP
 * - If inserting at end, returns last position + POSITION_GAP
 * - If inserting at start, returns midpoint of 0 and first position
 * - If inserting between, returns midpoint of adjacent positions
 */
export function calculateNewPosition(
  sortedItems: Positioned[],
  insertIndex: number
): number {
  // Empty list - use default gap
  if (sortedItems.length === 0) {
    return POSITION_GAP
  }

  // Inserting at end
  if (insertIndex >= sortedItems.length) {
    return sortedItems[sortedItems.length - 1]!.position + POSITION_GAP
  }

  // Inserting at start
  if (insertIndex === 0) {
    const firstPosition = sortedItems[0]!.position
    return Math.floor(firstPosition / 2)
  }

  // Inserting between two items
  const prevPosition = sortedItems[insertIndex - 1]!.position
  const nextPosition = sortedItems[insertIndex]!.position
  return Math.floor((prevPosition + nextPosition) / 2)
}

/**
 * Check if the sorted items need rebalancing due to small gaps.
 * Returns true if any adjacent gap is less than MIN_GAP.
 */
export function needsRebalance(sortedItems: Positioned[]): boolean {
  if (sortedItems.length < 2) {
    return false
  }

  for (let i = 1; i < sortedItems.length; i++) {
    const gap = sortedItems[i]!.position - sortedItems[i - 1]!.position
    if (gap < MIN_GAP) {
      return true
    }
  }

  return false
}

/**
 * Generate rebalanced positions for items.
 * Returns array of { id, position } for items that need updating.
 */
export function rebalancePositions<T extends Positioned & { id: string }>(
  sortedItems: T[]
): Array<{ id: string; position: number }> {
  const updates: Array<{ id: string; position: number }> = []

  for (let i = 0; i < sortedItems.length; i++) {
    const newPosition = (i + 1) * POSITION_GAP
    if (sortedItems[i]!.position !== newPosition) {
      updates.push({
        id: sortedItems[i]!.id,
        position: newPosition,
      })
    }
  }

  return updates
}
