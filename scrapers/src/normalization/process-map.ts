// Maps raw process text to standardized process enum values

import { foldTr } from './text-match.js';

// Patterns are written for foldTr output (lowercase ASCII), so every Turkish casing and spelling variant matches.
// Order is priority: the first entry is the coffee's primary process, and a matched span is not read again by a
// later entry ("semi washed" is not also "washed", "pulped natural" is not also "natural").
// [process, pattern, ambiguous]. Ambiguous words ("natural", "doğal", "experimental", "deneysel") are everyday adjectives,
// so they only count where the text is stating a process; see detectProcesses.
const PROCESS_SOURCES: [string, string, boolean][] = [
  ['anaerobic', 'anaerobic|anaerobik|karbonik\\s*maserasyon|karbonik|karbik\\s*maserasyon|karbik|carbonic', false],
  ['experimental', '(?:double|extended)\\s*ferment(?:ation)?|lactic|thermal\\s*shock|termal\\s*sok|honey\\s*wine', false],
  ['experimental', 'experimental|deneysel', true],
  ['semi_washed', 'semi[\\s-]*washed|yari\\s*yikanmis|yari\\s*yikama', false],
  ['wet_hulled', 'wet[\\s-]*hulled|giling\\s*basah', false],
  ['honey', 'honey|bal\\s*islem|pulped\\s*natural', false],
  ['washed', 'washed|yikanmis|fully\\s*washed', false],
  ['natural', 'natural|naturel|dogal|kuru\\s*islem', true],
];
const PROCESS_MAP = PROCESS_SOURCES.map(([process, source, ambiguous]): [string, RegExp, boolean] => [
  process,
  new RegExp(`(?:^|[^a-z0-9])(${source})(?=$|[^a-z0-9])`, 'g'),
  ambiguous,
]);

export const PROCESS_LABEL = 'islem|isleme|islemi|process|processing|proses|yontem|yontemi';
const LABEL = `(?:${PROCESS_LABEL})[a-z]*`; // Turkish suffixes: "işlemin", "işlemle"
const ADJECTIVE = '(?:natural|naturel|dogal|kuru|experimental|deneysel)';
// "Natural process", "Doğal işlem" / "İşlem: Natural", "İşlem Türü: Doğal": the word touches the label.
const NEXT_TO_LABEL = new RegExp(`(?:^|[^a-z0-9])(${ADJECTIVE}\\s+${LABEL}|${LABEL}(?:\\s+(?:turu|tipi|yontemi|yontem|method|type))?\\s*[:\\-–/]?\\s*\\(?\\s*${ADJECTIVE})(?=$|[^a-z0-9])`, 'g');

// Up to 25 characters before and 40 after a process label, within one sentence: where a roaster lists the process.
const AROUND_LABEL = new RegExp(`(?:^|[^a-z0-9])([^.!?\\n;|]{0,25}?${LABEL}[^.!?\\n;|]{0,40})`, 'g');

/** The places where a roaster states a process in prose: an ambiguous word right beside a process label. */
export function processContexts(text: string): string[] {
  return [...foldTr(text).matchAll(NEXT_TO_LABEL)].map((match) => match[1]);
}

/**
 * Every process stated in `free`. Ambiguous adjectives ("natural", "doğal") only count in `stated`: the name,
 * a roaster-labelled field, or beside a process label. Defaults to trusting all of `free`.
 */
export function detectProcesses(free: string, stated: string = free): { process: string; detail: string }[] {
  const source = { free, stated };
  const folded = { free: foldTr(free), stated: foldTr(stated) };
  const found: { process: string; detail: string }[] = [];

  for (const [process, regex, ambiguous] of PROCESS_MAP) {
    const key = ambiguous ? 'stated' : 'free';
    regex.lastIndex = 0;
    const match = regex.exec(folded[key]);
    if (match && !found.some((entry) => entry.process === process)) {
      const start = match.index + match[0].length - match[1].length;
      const original = source[key].length === folded[key].length ? source[key].slice(start, start + match[1].length) : match[1];
      found.push({ process, detail: original });
    }
    for (const name of ['free', 'stated'] as const) {
      folded[name] = folded[name].replace(regex, (span) => ' '.repeat(span.length));
    }
  }
  return found;
}

/**
 * The processes a product states. What the roaster declares (name, labelled fields, text beside a process label) is
 * the whole answer when it names any; otherwise any process word in the prose counts, except the ambiguous adjectives.
 */
export function processesStatedIn(name: string, labelled: string, text: string): { process: string; detail: string }[] {
  const declared = `${name} | ${labelled}`;
  const stated = [declared, ...processContexts(text)].join(' | ');
  const beside = [declared, ...[...foldTr(text).matchAll(AROUND_LABEL)].map((match) => match[1])].join(' | ');
  const found = detectProcesses(beside, stated);
  return found.length ? found : detectProcesses(text, stated);
}
