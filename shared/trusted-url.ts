export interface TrustedHttpUrlOptions {
  allowedHosts?: readonly string[];
  allowSubdomains?: boolean;
  baseUrl?: string;
}

export function normalizeTrustedHttpUrl(
  input: string | null | undefined,
  options: TrustedHttpUrlOptions = {}
) {
  const rawValue = input?.trim();
  if (!rawValue) return null;

  let url: URL;
  try {
    url = options.baseUrl ? new URL(rawValue, options.baseUrl) : new URL(rawValue);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;

  const allowedHosts = normalizeHosts(options.allowedHosts ?? []);
  if (allowedHosts.size > 0 && !isAllowedHost(url.hostname, allowedHosts, options.allowSubdomains)) {
    return null;
  }

  return url.toString();
}

export function isTrustedHttpUrl(
  input: string | null | undefined,
  options: TrustedHttpUrlOptions = {}
) {
  return normalizeTrustedHttpUrl(input, options) !== null;
}

export function collectTrustedHosts(values: readonly string[]) {
  const hosts = new Set<string>();

  for (const value of values) {
    const normalized = normalizeTrustedHost(value);
    if (!normalized) continue;

    hosts.add(normalized);
    if (normalized.startsWith('www.')) {
      hosts.add(normalized.slice(4));
    } else {
      hosts.add(`www.${normalized}`);
    }
  }

  return [...hosts].sort();
}

function normalizeHosts(hosts: readonly string[]) {
  return new Set(
    hosts
      .map((host) => normalizeTrustedHost(host))
      .filter((host): host is string => Boolean(host))
  );
}

function normalizeTrustedHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return null;
  }
}

function isAllowedHost(
  hostname: string,
  allowedHosts: Set<string>,
  allowSubdomains = false
) {
  const normalizedHostname = hostname.toLowerCase();
  if (allowedHosts.has(normalizedHostname)) return true;

  return allowSubdomains
    ? [...allowedHosts].some((allowedHost) => normalizedHostname.endsWith(`.${allowedHost}`))
    : false;
}
