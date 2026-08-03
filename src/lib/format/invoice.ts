export function formatInvoiceNumber(invoiceNumber: string | null | undefined) {
  const value = invoiceNumber?.trim();

  if (!value) {
    return "0001";
  }

  const lastNumber = value.match(/(\d+)$/)?.[1];

  return lastNumber ? lastNumber.padStart(4, "0") : value;
}
