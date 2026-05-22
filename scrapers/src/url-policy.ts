import {
  collectTrustedHosts,
  normalizeTrustedHttpUrl,
} from '../../shared/trusted-url.js';
import type { RoasterConfig } from './types.js';

const TRUSTED_IMAGE_HOSTS = [
  'cdn.shopify.com',
  'media.kafeinkultur.com',
  'static.ticimax.cloud',
] as const;

export function collectRoasterProductHosts(config: RoasterConfig) {
  return collectTrustedHosts([
    config.websiteUrl,
    config.shopUrl,
    ...(config.trustedProductHosts ?? []),
  ]);
}

export function collectRoasterImageHosts(config: RoasterConfig) {
  return collectTrustedHosts([
    config.websiteUrl,
    config.shopUrl,
    ...TRUSTED_IMAGE_HOSTS,
    ...(config.trustedImageHosts ?? []),
  ]);
}

export function normalizeRoasterProductUrl(
  input: string | null | undefined,
  config: RoasterConfig,
  baseUrl = config.shopUrl
) {
  return normalizeTrustedHttpUrl(input, {
    allowedHosts: collectRoasterProductHosts(config),
    baseUrl,
  });
}

export function normalizeRoasterImageUrl(
  input: string | null | undefined,
  config: RoasterConfig,
  baseUrl = config.shopUrl
) {
  return normalizeTrustedHttpUrl(input, {
    allowedHosts: collectRoasterImageHosts(config),
    baseUrl,
  });
}
