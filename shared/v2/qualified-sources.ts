/** Reviewed complete snapshots and pagination/SKU coverage, 2026-09-26 UTC.
 * Evidence: docs/free-catalog-refresh.md; caffe-di-toee reviewed 2026-10-05, see docs/data-quality.md.
 * A configured adapter alone does not qualify a source for scheduled ingestion.
 */
export const QUALIFIED_SOURCE_SLUGS = Object.freeze([
  'petra', 'montag', 'aroasting-lab', 'coach-coffee', 'coffeenutz',
  'nok-coffee', 'boxx', 'kimma', 'cup-of-joy', 'baristocrat',
  'daphne', 'parsa', 'poka', 'molecule',
  'homestead', 'null-coffee', 'old-java', 'coffee-friendzone', 'coffeemamma', 'sezy', 'williams',
  'paper', 'story', 'spada', 'gourme', 'hound', 'kernel', 'orkun-ustel', 'calibre', 'a4-kahve', 'tetra-n',
  'probador', 'coffee-department', 'coffeerem', 'kronotrop', 'milestones', 'kafeinkultur', 'ordinarius',
  'caffe-di-toee',
] as const);

export function isQualifiedSource(slug: string): boolean {
  return QUALIFIED_SOURCE_SLUGS.some(qualified => qualified === slug);
}
