export function emptyCatalogFailures(scannedCoffees: number): string[] {
  return scannedCoffees === 0
    ? ['No current public available coffees found; catalog freshness or scraper ingestion may be broken.']
    : [];
}
