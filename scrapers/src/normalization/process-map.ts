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

export function detectProcess(text: string): { process: string; processDetail: string | null } {
  for (const [regex, process] of PROCESS_MAP) {
    const match = text.match(regex);
    if (match) {
      return { process, processDetail: matchedToken(match) };
    }
  }
  return { process: 'unknown', processDetail: null };
}
