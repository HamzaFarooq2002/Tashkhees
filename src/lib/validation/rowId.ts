/** REST row ids are "parameterKey:rowKey" (colon-delimited). Existing keys are [a-z0-9_]+ and never contain ":". */
export function parseRowId(rowId: string): { parameterKey: string; rowKey: string } | null {
  const idx = rowId.indexOf(":");
  if (idx <= 0 || idx === rowId.length - 1) return null;
  return { parameterKey: rowId.slice(0, idx), rowKey: rowId.slice(idx + 1) };
}
