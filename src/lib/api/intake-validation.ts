import {
  BREW_METHOD_VALUES,
  FLAVOR_CATEGORIES,
  PROCESS_VALUES,
  ROAST_VALUES,
  SORT_VALUES,
} from '@/lib/constants/filter-options';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REDIRECT_SOURCES = new Set([
  'coffee_detail',
  'catalog_card',
  'quiz_result',
  'seo_page',
  'roaster_page',
]);

const FILTER_SORTS = new Set<string>(SORT_VALUES);
const QUIZ_BREWS = new Set(BREW_METHOD_VALUES);
const QUIZ_FLAVORS = new Set<string>(FLAVOR_CATEGORIES);
const QUIZ_PROCESSES = new Set(PROCESS_VALUES.filter((value) => value !== 'unknown'));
const QUIZ_ROAST_LEVELS = new Set(ROAST_VALUES.filter((value) => value !== 'unknown'));
const QUIZ_ADVENTURES = new Set(['classic', 'surprise']);
const QUIZ_ROASTS = new Set(['light', 'medium', 'dark', 'any']);
const QUIZ_BUDGETS = new Set(['low', 'mid', 'high', 'any']);

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type RequestValidationResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export interface ClickPayload {
  coffee_id: string;
  source: string;
  filter_context: JsonObject | null;
  quiz_context: JsonObject | null;
  page_path: string;
}

export function validateJsonRequest(
  request: Request,
  maxBodyBytes: number
): RequestValidationResult {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { ok: false, error: 'Invalid content type', status: 415 };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength != null) {
    const bytes = Number(contentLength);
    if (!Number.isInteger(bytes) || bytes < 0 || bytes > maxBodyBytes) {
      return { ok: false, error: 'Request body too large', status: 413 };
    }
  }

  const origin = request.headers.get('origin');
  if (origin && !isSameOrigin(origin, request.headers.get('host'))) {
    return { ok: false, error: 'Invalid request origin', status: 403 };
  }

  return { ok: true };
}

export function validateClickPayload(input: unknown): ValidationResult<ClickPayload> {
  if (!isRecord(input)) {
    return { ok: false, error: 'Invalid request body' };
  }

  const coffeeId = readRequiredUuid(input.coffee_id, 'coffee_id');
  if (!coffeeId.ok) return coffeeId;

  const source = readRequiredAllowlistedString(input.source, REDIRECT_SOURCES, 'source');
  if (!source.ok) return source;

  const pagePath = readRequiredPath(input.page_path, 'page_path');
  if (!pagePath.ok) return pagePath;

  const filterContext = readOptionalFilterContext(input.filter_context);
  if (!filterContext.ok) return filterContext;

  const quizContext = readOptionalQuizContext(input.quiz_context);
  if (!quizContext.ok) return quizContext;

  return {
    ok: true,
    data: {
      coffee_id: coffeeId.data,
      source: source.data,
      filter_context: filterContext.data,
      quiz_context: quizContext.data,
      page_path: pagePath.data,
    },
  };
}

function readOptionalFilterContext(input: unknown): ValidationResult<JsonObject | null> {
  if (input == null) return { ok: true, data: null };
  if (!isRecord(input)) {
    return { ok: false, error: 'Invalid filter_context' };
  }

  const context: JsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'origin':
      case 'process':
      case 'roastLevel':
      case 'roaster':
      case 'city':
      case 'flavorCategory':
      case 'brewMethod': {
        const values = readStringArray(value, key);
        if (!values.ok) return values;
        context[key] = values.data;
        break;
      }
      case 'search': {
        const search = readRequiredString(value, key, 1, 80);
        if (!search.ok) return search;
        context[key] = search.data;
        break;
      }
      case 'singleOrigin':
      case 'isDecaf':
        if (typeof value !== 'boolean') {
          return { ok: false, error: `Invalid ${key}` };
        }
        context[key] = value;
        break;
      case 'priceMin':
      case 'priceMax': {
        const numberValue = readBoundedNumber(value, key, 0, 5000);
        if (!numberValue.ok) return numberValue;
        context[key] = numberValue.data;
        break;
      }
      case 'sort': {
        const sort = readRequiredAllowlistedString(value, FILTER_SORTS, key);
        if (!sort.ok) return sort;
        context[key] = sort.data;
        break;
      }
      case 'page':
      case 'perPage': {
        const intValue = readBoundedInteger(value, key, 1, key === 'page' ? 1000 : 100);
        if (!intValue.ok) return intValue;
        context[key] = intValue.data;
        break;
      }
      default:
        return { ok: false, error: `Unsupported filter_context field: ${key}` };
    }
  }

  return { ok: true, data: Object.keys(context).length ? context : null };
}

function readOptionalQuizContext(input: unknown): ValidationResult<JsonObject | null> {
  if (input == null) return { ok: true, data: null };
  if (!isRecord(input)) {
    return { ok: false, error: 'Invalid quiz_context' };
  }

  const context: JsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'brewMethod': {
        const brewMethods = readAllowlistedStringArray(value, QUIZ_BREWS, key);
        if (!brewMethods.ok) return brewMethods;
        context[key] = brewMethods.data;
        break;
      }
      case 'flavorCategory': {
        const flavorCategories = readAllowlistedStringArray(value, QUIZ_FLAVORS, key);
        if (!flavorCategories.ok) return flavorCategories;
        context[key] = flavorCategories.data;
        break;
      }
      case 'process': {
        const processes = readAllowlistedStringArray(value, QUIZ_PROCESSES, key);
        if (!processes.ok) return processes;
        context[key] = processes.data;
        break;
      }
      case 'roastLevel': {
        const roastLevels = readAllowlistedStringArray(value, QUIZ_ROAST_LEVELS, key);
        if (!roastLevels.ok) return roastLevels;
        context[key] = roastLevels.data;
        break;
      }
      case 'priceMin':
      case 'priceMax': {
        const numberValue = readBoundedNumber(value, key, 0, 5000);
        if (!numberValue.ok) return numberValue;
        context[key] = numberValue.data;
        break;
      }
      case 'sort': {
        const sort = readRequiredAllowlistedString(value, FILTER_SORTS, key);
        if (!sort.ok) return sort;
        context[key] = sort.data;
        break;
      }
      case 'brew': {
        const brew = readOptionalAllowlistedString(value, QUIZ_BREWS, key);
        if (!brew.ok) return brew;
        if (brew.data != null) context[key] = brew.data;
        break;
      }
      case 'flavors': {
        const flavors = readAllowlistedStringArray(value, QUIZ_FLAVORS, key);
        if (!flavors.ok) return flavors;
        context[key] = flavors.data;
        break;
      }
      case 'adventure': {
        const adventure = readOptionalAllowlistedString(value, QUIZ_ADVENTURES, key);
        if (!adventure.ok) return adventure;
        if (adventure.data != null) context[key] = adventure.data;
        break;
      }
      case 'roast': {
        const roast = readOptionalAllowlistedString(value, QUIZ_ROASTS, key);
        if (!roast.ok) return roast;
        if (roast.data != null) context[key] = roast.data;
        break;
      }
      case 'budget': {
        const budget = readOptionalAllowlistedString(value, QUIZ_BUDGETS, key);
        if (!budget.ok) return budget;
        if (budget.data != null) context[key] = budget.data;
        break;
      }
      default:
        return { ok: false, error: `Unsupported quiz_context field: ${key}` };
    }
  }

  return { ok: true, data: Object.keys(context).length ? context : null };
}

function readRequiredUuid(input: unknown, field: string): ValidationResult<string> {
  if (typeof input !== 'string' || !UUID_PATTERN.test(input)) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: input.toLowerCase() };
}

function readRequiredAllowlistedString(
  input: unknown,
  allowed: Set<string>,
  field: string
): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: `Invalid ${field}` };
  }

  const value = input.trim();
  if (!allowed.has(value)) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: value };
}

function readOptionalAllowlistedString(
  input: unknown,
  allowed: Set<string>,
  field: string
): ValidationResult<string | null> {
  if (input == null || input === '') return { ok: true, data: null };
  const result = readRequiredAllowlistedString(input, allowed, field);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

function readRequiredString(
  input: unknown,
  field: string,
  minLength: number,
  maxLength: number
): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: `Invalid ${field}` };
  }

  const value = input.trim();
  if (value.length < minLength || value.length > maxLength) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: value };
}

function readRequiredPath(input: unknown, field: string): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: `Invalid ${field}` };
  }

  const value = input.trim();
  if (!isAllowedPath(value)) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: value };
}

function readStringArray(input: unknown, field: string): ValidationResult<string[]> {
  const values = Array.isArray(input) ? input : [input];
  if (values.length > 20) {
    return { ok: false, error: `Invalid ${field}` };
  }

  const cleanValues: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      return { ok: false, error: `Invalid ${field}` };
    }

    const cleanValue = value.trim();
    if (!cleanValue || cleanValue.length > 80) {
      return { ok: false, error: `Invalid ${field}` };
    }

    cleanValues.push(cleanValue);
  }

  return { ok: true, data: cleanValues };
}

function readAllowlistedStringArray(
  input: unknown,
  allowed: Set<string>,
  field: string
): ValidationResult<string[]> {
  if (!Array.isArray(input) || input.length > 20) {
    return { ok: false, error: `Invalid ${field}` };
  }

  const values: string[] = [];
  for (const value of input) {
    const allowedValue = readRequiredAllowlistedString(value, allowed, field);
    if (!allowedValue.ok) return allowedValue;
    values.push(allowedValue.data);
  }

  return { ok: true, data: values };
}

function readBoundedNumber(
  input: unknown,
  field: string,
  min: number,
  max: number
): ValidationResult<number> {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: input };
}

function readBoundedInteger(
  input: unknown,
  field: string,
  min: number,
  max: number
): ValidationResult<number> {
  const result = readBoundedNumber(input, field, min, max);
  if (!result.ok) return result;
  if (!Number.isInteger(result.data)) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return result;
}

function isAllowedPath(path: string) {
  if (path.length === 0 || path.length > 160) return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('?') || path.includes('#')) return false;

  return /^\/$/.test(path)
    || /^\/coffees\/?$/.test(path)
    || /^\/coffees\/[a-z0-9-]+\/?$/.test(path)
    || /^\/roasters\/?$/.test(path)
    || /^\/roasters\/[a-z0-9-]+\/?$/.test(path)
    || /^\/quiz\/?$/.test(path);
}

function isSameOrigin(origin: string, host: string | null) {
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    const isLocalOrigin =
      originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';

    return originUrl.host === host && (originUrl.protocol === 'https:' || isLocalOrigin);
  } catch {
    return false;
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
