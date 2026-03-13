import fs from 'fs-extra'
import * as XLSX from 'xlsx'

export type XlsxRow = Record<string, string | number | boolean | undefined>

export type Workbook = XLSX.WorkBook

export const readWorkbook = async (path: string): Promise<Workbook> => {
  const buf = await fs.readFile(path)
  return XLSX.read(buf, { type: 'buffer' })
}

export const hasSheet = (
  workbook: Workbook,
  sheetNameOrAlternates: string | readonly string[],
): boolean => {
  const names = Array.isArray(sheetNameOrAlternates)
    ? sheetNameOrAlternates
    : [sheetNameOrAlternates]
  return names.some((n) => workbook.Sheets[n] != null)
}

/**
 * Return rows for a sheet. sheetNameOrAlternates: primary name or [primary, ...alternates]
 * (e.g. 'Products' or ['Products', 'Product']). Returns [] if sheet is missing.
 */
export const getSheetAsRows = (
  workbook: Workbook,
  sheetNameOrAlternates: string | readonly string[],
): XlsxRow[] => {
  const names = Array.isArray(sheetNameOrAlternates)
    ? sheetNameOrAlternates
    : [sheetNameOrAlternates]
  const sheet = names.map((n) => workbook.Sheets[n]).find(Boolean)
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<XlsxRow>(sheet, { defval: '' })
}

export const createWorkbook = (): Workbook => XLSX.utils.book_new()

export const appendSheet = (
  workbook: Workbook,
  sheetName: string,
  rows: Record<string, unknown>[],
): void => {
  const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([])
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
}

export const writeWorkbook = async (workbook: Workbook, path: string): Promise<void> => {
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  await fs.writeFile(path, buf)
}
