import { describe, it, expect } from 'vitest'
import { calculateNewPosition, needsRebalance, POSITION_GAP, MIN_GAP } from '@/utils/position'

describe('position utilities', () => {
  describe('calculateNewPosition', () => {
    it('returns POSITION_GAP for empty list (first item)', () => {
      const position = calculateNewPosition([], 0)
      expect(position).toBe(POSITION_GAP)
    })

    it('returns position after last item when inserting at end', () => {
      const items = [
        { position: 1000 },
        { position: 2000 },
        { position: 3000 },
      ]
      const position = calculateNewPosition(items, 3)
      expect(position).toBe(4000)
    })

    it('returns position before first item when inserting at start', () => {
      const items = [
        { position: 1000 },
        { position: 2000 },
      ]
      const position = calculateNewPosition(items, 0)
      expect(position).toBe(500) // midpoint of 0 and 1000
    })

    it('returns midpoint when inserting between items', () => {
      const items = [
        { position: 1000 },
        { position: 3000 },
      ]
      const position = calculateNewPosition(items, 1)
      expect(position).toBe(2000) // midpoint of 1000 and 3000
    })

    it('handles small gaps correctly', () => {
      const items = [
        { position: 100 },
        { position: 110 },
      ]
      const position = calculateNewPosition(items, 1)
      expect(position).toBe(105) // midpoint of 100 and 110
    })
  })

  describe('needsRebalance', () => {
    it('returns false when gap is large enough', () => {
      const items = [
        { position: 1000 },
        { position: 2000 },
      ]
      expect(needsRebalance(items)).toBe(false)
    })

    it('returns true when gap is too small', () => {
      const items = [
        { position: 100 },
        { position: 105 }, // gap of 5, less than MIN_GAP (10)
      ]
      expect(needsRebalance(items)).toBe(true)
    })

    it('returns false for empty list', () => {
      expect(needsRebalance([])).toBe(false)
    })

    it('returns false for single item', () => {
      expect(needsRebalance([{ position: 1000 }])).toBe(false)
    })

    it('returns true if any adjacent gap is too small', () => {
      const items = [
        { position: 1000 },
        { position: 2000 },
        { position: 2005 }, // small gap here
        { position: 3000 },
      ]
      expect(needsRebalance(items)).toBe(true)
    })
  })
})
