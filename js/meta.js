// GET /filter-options is fetched once and cached. Venues, formats, languages, time bands, sorts,
// ticket types, seat cap and hold duration all come from here - nothing is hardcoded in the UI.
import { api } from './api.js';

let promise = null;
let cached = null;

export function getOptions() {
  if (cached) return Promise.resolve(cached);
  if (!promise) {
    promise = api.filterOptions()
      .then((data) => { cached = data; return data; })
      .catch((e) => { promise = null; throw e; }); // allow retry after a failure
  }
  return promise;
}
export const optionsSync = () => cached;
