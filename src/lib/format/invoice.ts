export function formatInvoiceNumber(invoiceNumber: string | null | undefined) {
  const value = invoiceNumber?.trim();

  if (!value) {
    return "0001";
  }

  const lastNumber = value.match(/(\d+)$/)?.[1];

  return lastNumber ? lastNumber.padStart(4, "0") : value;
}

export function formatInvoiceDateKey(dateKey: string | null | undefined) {
  const parts = dateKey?.split("-");

  if (!parts || parts.length !== 3) {
    return dateKey ?? "";
  }

  const [year, month, day] = parts;

  return `${month}/${day}/${year}`;
}

export function formatInvoiceLineDescription(description: string) {
  return description.replace(
    /Units completed (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/,
    (_match, start: string, end: string) =>
      `Units completed ${formatInvoiceDateKey(start)} to ${formatInvoiceDateKey(end)}`,
  );
}
