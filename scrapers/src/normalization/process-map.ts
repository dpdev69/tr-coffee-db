// Maps raw process text to standardized process enum values

import { matchedToken, tokenRegex } from './text-match.js';

const PROCESS_MAP: [RegExp, string][] = [
  [tokenRegex(String.raw`anaerobic|anaerobik|karbonik\s*maserasyon|karbonik|karbik\s*maserasyon|karbik|carbonic`), 'anaerobic'],
  [tokenRegex(String.raw`experimental|deneysel|double\s*ferment(?:ation)?|extended\s*ferment(?:ation)?|lactic|thermal\s*shock`), 'experimental'],
  [tokenRegex(String.raw`semi[\s-]*washed|yarı\s*yıkanmış|yari\s*yikanmis|yarı\s*yıkama|yari\s*yikama`), 'semi_washed'],
  [tokenRegex(String.raw`wet[\s-]*hulled|giling\s*basah`), 'wet_hulled'],
  [tokenRegex(String.raw`honey|bal\s*işlem|bal\s*islem|pulped\s*natural`), 'honey'],
  [tokenRegex(String.raw`washed|yıkanmış|yikanmis|fully\s*washed`), 'washed'],
  [tokenRegex(String.raw`natural|natürel|naturel|doğal|dogal|kuru\s*işlem|kuru\s*islem`), 'natural'],
];

const STANDALONE_PROCESS_MAP: [RegExp, string][] = [
  [/^(?:anaerobic|anaerobik|karbonik\s*maserasyon|karbonik|carbonic)$/iu, 'anaerobic'],
  [/^(?:experimental|deneysel|double\s*fermentation|extended\s*fermentation|lactic|thermal\s*shock)$/iu, 'experimental'],
  [/^(?:semi[\s-]*washed|yarı\s*yıkanmış|yari\s*yikanmis|yarı\s*yıkama|yari\s*yikama)$/iu, 'semi_washed'],
  [/^(?:wet[\s-]*hulled|giling\s*basah)$/iu, 'wet_hulled'],
  [/^(?:honey|bal\s*işlem|bal\s*islem|pulped\s*natural)$/iu, 'honey'],
  [/^(?:washed|yıkanmış|yikanmis|fully\s*washed)$/iu, 'washed'],
  [/^(?:natural|natürel|naturel|doğal|dogal|kuru\s*işlem|kuru\s*islem)$/iu, 'natural'],
];

export function detectProcess(text: string): { process: string; processDetail: string | null } {
  for (const [regex, process] of PROCESS_MAP) {
    const match = text.match(regex);
    if (match) {
      return { process, processDetail: matchedToken(match) };
    }
  }
  return { process: 'unknown', processDetail: null };
}

export function detectStandaloneProcess(text: string): { process: string; processDetail: string | null } {
  const normalized = text.replace(/\s+/g, ' ').trim();

  for (const [regex, process] of STANDALONE_PROCESS_MAP) {
    if (regex.test(normalized)) {
      return { process, processDetail: normalized };
    }
  }

  return { process: 'unknown', processDetail: null };
}
