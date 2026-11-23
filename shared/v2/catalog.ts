/** The catalog read model. The code lives in shared/v2/catalog/; this barrel keeps the public surface in one place, so every
 * import of './catalog' keeps working. Helpers shared only between the catalog modules are deliberately not re-exported. */
export type { CatalogCoffee, CatalogFilters, CatalogOffer, CatalogRoaster, CoffeeRow } from './catalog/types';
export { COFFEE_COLUMNS } from './catalog/sql';
export { hydrate, listedRows } from './catalog/hydrate';
export { withoutTrailingSize } from './catalog/mappers';
export type { ListIndex, ListIndexCoffee } from './catalog/list-index';
export { listIndex } from './catalog/list-index';
export {
  catalogFacts,
  catalogFactsMany,
  countCatalog,
  getCatalogCounts,
  lastGoodListingName,
  listCatalog,
} from './catalog/listing';
export type { ChangeDay } from './catalog/changes';
export { CHANGE_EVENTS, catalogChangesByDay, listEvents } from './catalog/changes';
export {
  getCoffeeDetail,
  getCoffeeOfTheDay,
  getPriceHistory,
  getSavedCoffees,
  listOrigins,
  SAVED_LIMIT,
  SAVED_SLUG,
} from './catalog/coffees';
export { getRoasterDetail, listRoasters } from './catalog/roasters';
export type { SimilarityCandidate } from './catalog/similarity';
export { getSimilarCoffees, similarityCandidates } from './catalog/similarity';
