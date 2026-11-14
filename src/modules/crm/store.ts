"use client";
export function exportCsv(filename: string, rows: (string | number)[][]) {
  // Prefix formula-like content to keep exported user input safe in spreadsheets.
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  downloadFile(
    filename,
    "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export function downloadFile(
  filename: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
