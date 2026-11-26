import { lazy } from 'react';

/* React.lazy with one safe retry.
   After a new version is deployed, a tab that was opened before it may ask for a page file
   that no longer exists. Reload the page once to get the new version instead of showing a
   blank screen. The flag stops it from reloading over and over. */
const FLAG = 'ayon_chunk_reload';

export default function lazyPage(load) {
  return lazy(() =>
    load()
      .then((mod) => {
        try { sessionStorage.removeItem(FLAG); } catch { /* storage off: nothing to clear */ }
        return mod;
      })
      .catch((err) => {
        let reloaded = false;
        try { reloaded = sessionStorage.getItem(FLAG) === '1'; } catch { /* storage off */ }
        if (!reloaded) {
          try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage off */ }
          window.location.reload();
          return new Promise(() => {});          // the page is reloading
        }
        throw err;                               // already tried once: show the error
      })
  );
}