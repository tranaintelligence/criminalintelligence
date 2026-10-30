/**
 * Safe and reliable CSV download helper for all modern browsers.
 * Uses Blob and URL.createObjectURL to avoid data: URI security blocks in Chromium browsers.
 */

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  const escapeCell = (cell: string | number | boolean | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const bodyRows = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const csvContent = '\uFEFF' + headerRow + '\r\n' + bodyRows; // UTF-8 BOM for Excel / Google Sheets compatibility

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

