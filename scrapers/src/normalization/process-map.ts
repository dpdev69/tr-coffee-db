// Maps raw process text to standardized process enum values

const PROCESS_MAP: [RegExp, string][] = [
  [/\b(washed|yıkanmış|yikanmis|fully\s*washed)\b/i, 'washed'],
  [/\b(natural|natürel|naturel|doğal|dogal|kuru\s*işlem)\b/i, 'natural'],
  [/\b(honey|bal\s*işlem|pulped\s*natural)\b/i, 'honey'],
  [/\b(anaerobic|anaerobik|karbik\s*maserasyon|karbik|carbonic)\b/i, 'anaerobic'],
  [/\b(semi[\s-]*washed|yarı\s*yıkanmış|yarı\s*yıkama)\b/i, 'semi_washed'],
  [/\b(wet[\s-]*hulled|giling\s*basah)\b/i, 'wet_hulled'],
  [/\b(experimental|deneysel|double\s*ferment|extended\s*ferment|lactic|thermal\s*shock)\b/i, 'experimental'],
];

export function detectProcess(text: string): { process: string; processDetail: string | null } {
  for (const [regex, process] of PROCESS_MAP) {
    const match = text.match(regex);
    if (match) {
      return { process, processDetail: match[0] };
    }
  }
  return { process: 'unknown', processDetail: null };
}
