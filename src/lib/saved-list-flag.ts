/** Inline script body: a stored list sets data-saved-list on <html> before paint. Any storage or parse failure leaves it unset. */
export function savedListFlagScript(key: string): string {
  return `try{if(JSON.parse(localStorage.getItem(${JSON.stringify(key)})||"[]").length)document.documentElement.dataset.savedList=""}catch(e){}`;
}
