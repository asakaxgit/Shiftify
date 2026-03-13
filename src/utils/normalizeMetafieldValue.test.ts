import { describe, expect, it } from 'vitest'
import { normalizeMetafieldValue } from './normalizeMetafieldValue'

describe('normalizeMetafieldValue', () => {
  describe('date_time', () => {
    it('returns already-normalized value unchanged', () => {
      expect(normalizeMetafieldValue('date_time', '2024-01-15T10:30:00')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('normalizes UTC Z suffix', () => {
      expect(normalizeMetafieldValue('date_time', '2024-01-15T10:30:00Z')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('normalizes +00:00 offset', () => {
      expect(normalizeMetafieldValue('date_time', '2024-01-15T10:30:00+00:00')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('normalizes fractional seconds with Z', () => {
      expect(normalizeMetafieldValue('date_time', '2024-01-15T10:30:00.000Z')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('normalizes fractional seconds without timezone', () => {
      expect(normalizeMetafieldValue('date_time', '2024-01-15T10:30:00.123')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('is case-insensitive on type', () => {
      expect(normalizeMetafieldValue('DATE_TIME', '2024-01-15T10:30:00Z')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('returns original value when unparseable', () => {
      expect(normalizeMetafieldValue('date_time', 'not-a-date')).toBe('not-a-date')
    })
  })

  describe('date', () => {
    it('returns already-normalized value unchanged', () => {
      expect(normalizeMetafieldValue('date', '2024-01-15')).toBe('2024-01-15')
    })

    it('normalizes from ISO string', () => {
      expect(normalizeMetafieldValue('date', '2024-01-15T00:00:00Z')).toBe('2024-01-15')
    })

    it('returns original value when unparseable', () => {
      expect(normalizeMetafieldValue('date', 'not-a-date')).toBe('not-a-date')
    })
  })

  describe('other types', () => {
    it('returns value unchanged for non-date types', () => {
      expect(normalizeMetafieldValue('single_line_text_field', 'hello world')).toBe('hello world')
      expect(normalizeMetafieldValue('number_integer', '42')).toBe('42')
    })

    it('trims whitespace', () => {
      expect(normalizeMetafieldValue('date_time', '  2024-01-15T10:30:00Z  ')).toBe(
        '2024-01-15T10:30:00',
      )
    })

    it('returns empty string unchanged', () => {
      expect(normalizeMetafieldValue('date_time', '   ')).toBe('')
    })
  })
})
