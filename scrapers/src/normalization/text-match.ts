const TOKEN_LEFT = String.raw`(?:^|[^\p{L}\p{N}])`;
const TOKEN_RIGHT = String.raw`(?=$|[^\p{L}\p{N}])`;

export function tokenRegex(source: string): RegExp {
  return new RegExp(`${TOKEN_LEFT}(${source})${TOKEN_RIGHT}`, 'iu');
}

export function matchedToken(match: RegExpMatchArray): string {
  return (match[1] ?? match[0]).trim();
}
