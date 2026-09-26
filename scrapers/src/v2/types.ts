export type { SourceCoffee, SourceOffer, CrawlDiagnostic as AdapterDiagnostic } from '../../../shared/v2/types.js';
import type { SourceCoffee, CrawlDiagnostic } from '../../../shared/v2/types.js';
export interface SourceCrawl {
  roasterSlug: string;
  parserVersion: string;
  complete: boolean;
  products: SourceCoffee[];
  diagnostics: CrawlDiagnostic[];
  retryAfterSeconds?: number;
}
