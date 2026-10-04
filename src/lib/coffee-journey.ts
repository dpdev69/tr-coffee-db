import { legacyCatalogDatabase, legacyCoffeeDetail, archivedJourney, toLegacyCoffee } from '@/lib/v2-legacy';
import type {
  Coffee,
  CoffeeAssessment,
  CoffeeCertification,
  CoffeeClaim,
  CoffeeLot,
  CoffeeWithRoaster,
  TraceEvent,
  TraceSource,
  ValidationStatus,
} from '@/lib/types/database';

export interface CoffeeJourney {
  lot: CoffeeLot;
  events: TraceEvent[];
  sources: TraceSource[];
  claims: CoffeeClaim[];
  assessments: CoffeeAssessment[];
  certifications: CoffeeCertification[];
  usesFallback: boolean;
}

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  observed: 'Kaynakta gözlemlendi',
  self_reported: 'Partner beyanı',
  corroborated: 'Birden fazla kaynakla desteklendi',
  partner_confirmed: 'Partner tarafından onaylandı',
  document_verified: 'Belgeyle doğrulandı',
  independently_assessed: 'Bağımsız değerlendirildi',
  disputed: 'İtirazlı bilgi',
  expired: 'Süresi dolmuş kanıt',
};

export const VALIDATION_STRENGTH: Record<ValidationStatus, number> = {
  disputed: 0,
  expired: 1,
  observed: 2,
  self_reported: 3,
  corroborated: 4,
  partner_confirmed: 5,
  document_verified: 6,
  independently_assessed: 7,
};

export async function getCoffeeJourney(coffee: CoffeeWithRoaster): Promise<CoffeeJourney> {
  const db = await legacyCatalogDatabase();
  if (db) {
    const current = await legacyCoffeeDetail(db, coffee.id);
    if (!current) throw new Error('Public coffee unavailable');
    const archived = current.green_lot_id ? await archivedJourney(db, current.green_lot_id) : null;
    return archived ?? buildFallbackJourney(toLegacyCoffee(current.v2_source, current.legacy_archive, true));
  }
  if (!coffee.green_lot_id) return buildFallbackJourney(coffee);

  const supabase = await (await import('@/lib/supabase/server')).createClient();
  const lotId = coffee.green_lot_id;
  const [lotResult, eventsResult, sourcesResult, claimsResult, assessmentsResult, certificationsResult] =
    await Promise.all([
      supabase.from('coffee_lots').select('*').eq('id', lotId).maybeSingle(),
      supabase
        .from('trace_events')
        .select('*')
        .eq('lot_id', lotId)
        .order('sequence_number', { ascending: true })
        .order('event_at', { ascending: true, nullsFirst: true }),
      supabase
        .from('trace_sources')
        .select('*')
        .eq('lot_id', lotId)
        .order('observed_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('coffee_claims')
        .select('*')
        .eq('subject_type', 'coffee_lot')
        .eq('subject_id', lotId)
        .order('confidence', { ascending: false }),
      supabase
        .from('coffee_assessments')
        .select('*')
        .eq('lot_id', lotId)
        .order('score', { ascending: false, nullsFirst: false }),
      supabase
        .from('coffee_certifications')
        .select('*')
        .eq('lot_id', lotId)
        .order('valid_to', { ascending: false, nullsFirst: false }),
    ]);

  const firstError = [
    lotResult.error,
    eventsResult.error,
    sourcesResult.error,
    claimsResult.error,
    assessmentsResult.error,
    certificationsResult.error,
  ].find(Boolean);

  if (firstError || !lotResult.data) {
    console.info('Lot journey schema unavailable; rendering observed catalog journey', {
      coffee_id: coffee.id,
      code: firstError?.code,
      message: firstError?.message,
    });
    return buildFallbackJourney(coffee);
  }

  return {
    lot: lotResult.data,
    events: eventsResult.data ?? [],
    sources: sourcesResult.data ?? [],
    claims: claimsResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
    certifications: certificationsResult.data ?? [],
    usesFallback: false,
  };
}

export function calculateTraceabilityScore(coffee: Pick<
  Coffee,
  | 'origin_country'
  | 'origin_region'
  | 'origin_farm'
  | 'origin_producer'
  | 'origin_altitude'
  | 'harvest_year'
  | 'process'
  | 'variety'
  | 'sca_score'
>) {
  const score =
    (coffee.origin_country ? 15 : 0) +
    (coffee.origin_region ? 10 : 0) +
    (coffee.origin_farm ? 15 : 0) +
    (coffee.origin_producer ? 15 : 0) +
    (coffee.origin_altitude ? 5 : 0) +
    (coffee.harvest_year ? 10 : 0) +
    (coffee.process && coffee.process !== 'unknown' ? 10 : 0) +
    (coffee.variety ? 10 : 0) +
    (coffee.sca_score != null ? 10 : 0);

  return Math.min(100, score);
}

export function getJourneyKnownSteps(journey: CoffeeJourney) {
  return new Set(journey.events.map((event) => event.event_type)).size;
}

export function getJourneyValidationStatus(journey: CoffeeJourney): ValidationStatus {
  const statuses = [
    journey.lot.validation_status,
    ...journey.events.map((event) => event.validation_status),
    ...journey.claims.map((claim) => claim.validation_status),
    ...journey.assessments.map((assessment) => assessment.validation_status),
    ...journey.certifications.map((certification) => certification.validation_status),
  ];

  return statuses.reduce<ValidationStatus>((strongest, status) =>
    VALIDATION_STRENGTH[status] > VALIDATION_STRENGTH[strongest] ? status : strongest
  , 'observed');
}

function buildFallbackJourney(coffee: CoffeeWithRoaster): CoffeeJourney {
  const lotId = coffee.green_lot_id ?? `observed-${coffee.id}`;
  const observedAt = coffee.last_seen_at ?? coffee.updated_at;
  const sourceId = `product-${coffee.id}`;
  const events: TraceEvent[] = [];

  if (coffee.origin_country || coffee.origin_region || coffee.origin_farm) {
    events.push({
      id: `origin-${coffee.id}`,
      external_key: `origin:${coffee.id}`,
      lot_id: lotId,
      event_type: 'produced',
      organization_id: null,
      sequence_number: 10,
      title: coffee.origin_farm ?? coffee.origin_region ?? coffee.origin_country ?? 'Köken',
      description: coffee.origin_producer
        ? `${coffee.origin_producer} tarafından üretildiği belirtiliyor.`
        : 'Köken bilgisi kavurucunun ürün sayfasından alındı.',
      event_at: null,
      location_name: coffee.origin_farm,
      location_region: coffee.origin_region,
      location_country: coffee.origin_country,
      source_id: sourceId,
      validation_status: 'observed',
      is_public: true,
      created_at: observedAt,
      updated_at: observedAt,
    });
  }

  if (coffee.process !== 'unknown') {
    events.push({
      id: `process-${coffee.id}`,
      external_key: `processed:${coffee.id}`,
      lot_id: lotId,
      event_type: 'processed',
      organization_id: null,
      sequence_number: 30,
      title: `${coffee.process} işleme`,
      description: coffee.process_detail,
      event_at: null,
      location_name: null,
      location_region: coffee.origin_region,
      location_country: coffee.origin_country,
      source_id: sourceId,
      validation_status: 'observed',
      is_public: true,
      created_at: observedAt,
      updated_at: observedAt,
    });
  }

  events.push(
    {
      id: `roasted-${coffee.id}`,
      external_key: `roasted:${coffee.id}`,
      lot_id: lotId,
      event_type: 'roasted',
      organization_id: null,
      sequence_number: 80,
      title: `${coffee.roasters.name} tarafından kavruldu`,
      description: coffee.roast_level !== 'unknown' ? `${coffee.roast_level} kavrum` : null,
      event_at: parseDate(coffee.roast_date),
      location_name: coffee.roasters.city,
      location_region: coffee.roasters.city,
      location_country: 'Türkiye',
      source_id: sourceId,
      validation_status: 'observed',
      is_public: true,
      created_at: observedAt,
      updated_at: observedAt,
    },
    {
      id: `listed-${coffee.id}`,
      external_key: `listed:${coffee.id}`,
      lot_id: lotId,
      event_type: 'listed',
      organization_id: null,
      sequence_number: 90,
      title: 'Türkiye pazarında listelendi',
      description: coffee.price_amount
        ? `${coffee.price_amount.toLocaleString('tr-TR')} ${coffee.price_currency} fiyatla gözlemlendi.`
        : 'Kavurucunun mağazasında gözlemlendi.',
      event_at: coffee.last_seen_at,
      location_name: null,
      location_region: coffee.roasters.city,
      location_country: 'Türkiye',
      source_id: sourceId,
      validation_status: 'observed',
      is_public: true,
      created_at: observedAt,
      updated_at: observedAt,
    }
  );

  const source: TraceSource = {
    id: sourceId,
    coffee_id: coffee.id,
    lot_id: lotId,
    source_type: 'product_page',
    title: `${coffee.roasters.name} ürün sayfası`,
    source_url: coffee.product_url,
    publisher: coffee.roasters.name,
    observed_at: coffee.last_seen_at,
    retrieved_at: coffee.last_scraped_at ?? coffee.updated_at,
    content_hash: null,
    is_public: true,
    created_at: coffee.created_at,
  };

  const assessments: CoffeeAssessment[] = coffee.sca_score == null ? [] : [{
    id: `assessment-${coffee.id}`,
    lot_id: lotId,
    coffee_id: coffee.id,
    protocol: 'roaster_reported_legacy_score',
    assessment_type: 'legacy_score',
    score: coffee.sca_score,
    assessor_name: null,
    assessor_organization: null,
    assessed_at: null,
    dimensions: {},
    source_id: sourceId,
    validation_status: 'observed',
    is_public: true,
    created_at: observedAt,
    updated_at: observedAt,
  }];

  return {
    lot: {
      id: lotId,
      lot_code: null,
      display_name: coffee.name_normalized ?? coffee.name,
      origin_country: coffee.origin_country,
      origin_region: coffee.origin_region,
      farm_name: coffee.origin_farm,
      producer_name: coffee.origin_producer,
      altitude_text: coffee.origin_altitude,
      harvest_year: coffee.harvest_year,
      process: coffee.process,
      process_detail: coffee.process_detail,
      varieties: coffee.variety ? [coffee.variety] : [],
      traceability_score: calculateTraceabilityScore(coffee),
      validation_status: 'observed',
      is_public: true,
      created_at: coffee.created_at,
      updated_at: coffee.updated_at,
    },
    events,
    sources: [source],
    claims: [],
    assessments,
    certifications: [],
    usesFallback: true,
  };
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T00:00:00.000Z`;
}
