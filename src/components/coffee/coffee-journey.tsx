import Link from 'next/link';
import {
  getJourneyKnownSteps,
  getJourneyValidationStatus,
  VALIDATION_LABELS,
  type CoffeeJourney,
} from '@/lib/coffee-journey';
import type { TraceEvent, TraceSource, ValidationStatus } from '@/lib/types/database';

const EVENT_LABELS: Record<string, string> = {
  produced: 'Üretim',
  harvested: 'Hasat',
  processed: 'İşleme',
  milled: 'Değirmen',
  aggregated: 'Lot birleştirme',
  exported: 'İhracat',
  imported: 'İthalat',
  received: 'Teslim',
  stored: 'Depolama',
  roasted: 'Kavrum',
  packaged: 'Paketleme',
  listed: 'Pazarda',
};

export function CoffeeJourneySection({ journey }: { journey: CoffeeJourney }) {
  const knownSteps = getJourneyKnownSteps(journey);
  const strongestValidation = getJourneyValidationStatus(journey);
  const sourceMap = new Map(journey.sources.map((source) => [source.id, source]));

  return (
    <section id="journey" className="mt-14 scroll-mt-28">
      <div className="rounded-[30px] bg-[#171513] px-5 py-7 text-white sm:px-8 sm:py-9 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#ecff64]">
              Journey to cup
            </p>
            <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
              Bu kahve fincana nasıl geldi?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
              Bildiğimiz adımları, kimin söylediğini ve hangi noktaların hâlâ eksik olduğunu aynı
              kayıtta gösteriyoruz. Boşlukları tahminlerle doldurmuyoruz.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <JourneyMetric label="İzlenebilirlik" value={`${journey.lot.traceability_score}/100`} />
            <JourneyMetric label="Bilinen adım" value={String(knownSteps)} />
            <JourneyMetric label="Kaynak" value={String(journey.sources.length)} />
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8">
          <ol className="grid gap-3 lg:grid-flow-col lg:auto-cols-fr">
            {journey.events.map((event, index) => (
              <JourneyEventCard
                key={event.id}
                event={event}
                index={index}
                source={event.source_id ? sourceMap.get(event.source_id) : undefined}
              />
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-xs text-white/60">
          <ValidationBadge status={strongestValidation} dark />
          <span>
            Kayıttaki en güçlü doğrulama seviyesi. Her adım kendi kanıt seviyesini ayrıca taşır.
          </span>
          {journey.usesFallback && (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
              Lot kaydı bekleniyor, mevcut katalog verisi gösteriliyor
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function QualityDossier({ journey }: { journey: CoffeeJourney }) {
  return (
    <section className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <article className="rounded-[26px] border border-[#1f1d1b]/10 bg-white p-6 sm:p-7">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3a20]">
          Kalite dosyası
        </p>
        <div className="mt-5">
          {journey.assessments.length > 0 ? (
            <div className="space-y-4">
              {journey.assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="flex flex-col gap-4 rounded-2xl bg-[#f6f1e8] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1f1d1b]">
                      {formatProtocol(assessment.protocol)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#5d5853]">
                      {assessment.assessor_name || assessment.assessor_organization
                        ? [assessment.assessor_name, assessment.assessor_organization]
                            .filter(Boolean)
                            .join(' · ')
                        : 'Değerlendirici bilgisi yayınlanmamış'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {assessment.score != null && (
                      <span className="font-mono text-3xl font-bold text-[#1f1d1b]">
                        {assessment.score}
                      </span>
                    )}
                    <ValidationBadge status={assessment.validation_status} />
                  </div>
                </div>
              ))}
              <p className="text-xs leading-5 text-[#5d5853]">
                Yayınlanmış puan, bağımsız değerlendirme anlamına gelmez. Protokol ve kanıt seviyesi
                puandan ayrı tutulur.
              </p>
            </div>
          ) : (
            <EmptyEvidence
              title="Doğrulanabilir değerlendirme bulunamadı"
              description="Bu lot için protokolü ve kaynağı belirli bir kalite değerlendirmesi henüz kaydedilmedi."
            />
          )}
        </div>
      </article>

      <article className="rounded-[26px] border border-[#1f1d1b]/10 bg-white p-6 sm:p-7">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3a20]">
          Sertifikalar ve ticaret kanıtı
        </p>
        <div className="mt-5">
          {journey.certifications.length > 0 ? (
            <div className="space-y-3">
              {journey.certifications.map((certification) => (
                <div key={certification.id} className="rounded-2xl border border-[#1f1d1b]/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#1f1d1b]">{certification.scheme}</p>
                      <p className="mt-1 text-xs text-[#5d5853]">
                        {certification.holder_name || 'Sertifika sahibi belirtilmemiş'}
                        {certification.certificate_number
                          ? ` · ${certification.certificate_number}`
                          : ''}
                      </p>
                    </div>
                    <ValidationBadge status={certification.validation_status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyEvidence
              title="Sertifika kanıtı bulunamadı"
              description="Fairtrade, organik veya benzeri bir işaret yalnızca lotla eşleşen belge bulunduğunda burada görünür."
            />
          )}
        </div>
      </article>
    </section>
  );
}

export function EvidenceDrawer({ journey }: { journey: CoffeeJourney }) {
  const sourceMap = new Map(journey.sources.map((source) => [source.id, source]));

  return (
    <section className="mt-10 rounded-[26px] border border-[#1f1d1b]/10 bg-white p-6 sm:p-7">
      <div className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3a20]">
          Kanıt defteri
        </p>
        <h2 className="mt-2 font-display text-3xl leading-none text-[#1f1d1b]">
          Her bilgi nereden geliyor?
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5d5853]">
          Kaynaklar, gözlem zamanı ve doğrulama seviyesi ayrı tutulur. Bir kavurucunun yayınladığı
          bilgi ile bağımsız doğrulama aynı şey değildir.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <details className="group rounded-2xl border border-[#1f1d1b]/10 bg-[#fffdf8] p-4" open>
          <summary className="cursor-pointer list-none font-semibold text-[#1f1d1b]">
            Kaynaklar ({journey.sources.length})
          </summary>
          <div className="mt-4 space-y-3">
            {journey.sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </div>
        </details>

        <details className="group rounded-2xl border border-[#1f1d1b]/10 bg-[#fffdf8] p-4">
          <summary className="cursor-pointer list-none font-semibold text-[#1f1d1b]">
            Alan bazlı iddialar ({journey.claims.length})
          </summary>
          <div className="mt-4 space-y-3">
            {journey.claims.length > 0 ? (
              journey.claims.map((claim) => {
                const source = claim.source_id ? sourceMap.get(claim.source_id) : undefined;
                return (
                  <div key={claim.id} className="rounded-xl bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-[#1f1d1b]">
                        {formatFieldName(claim.field_name)}
                      </p>
                      <ValidationBadge status={claim.validation_status} />
                    </div>
                    <p className="mt-2 text-sm text-[#5d5853]">{formatClaimValue(claim.value)}</p>
                    <p className="mt-2 text-[11px] text-[#5d5853]/75">
                      Güven {claim.confidence}/100{source ? ` · ${source.publisher ?? source.title}` : ''}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-[#5d5853]">
                Alan bazlı kayıtlar lot migrasyonu uygulandığında burada görünecek.
              </p>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

export function ValidationBadge({
  status,
  dark = false,
}: {
  status: ValidationStatus;
  dark?: boolean;
}) {
  const strong = ['document_verified', 'independently_assessed', 'partner_confirmed'].includes(status);
  const warning = status === 'disputed' || status === 'expired';
  const color = warning
    ? dark
      ? 'border-red-300/30 bg-red-300/10 text-red-100'
      : 'border-red-200 bg-red-50 text-red-800'
    : strong
      ? dark
        ? 'border-[#ecff64]/30 bg-[#ecff64]/10 text-[#ecff64]'
        : 'border-lime-300 bg-lime-50 text-lime-900'
      : dark
        ? 'border-white/15 bg-white/5 text-white/75'
        : 'border-[#1f1d1b]/10 bg-[#f6f1e8] text-[#5d5853]';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${color}`}>
      {VALIDATION_LABELS[status]}
    </span>
  );
}

function JourneyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="font-mono text-lg font-bold text-white sm:text-xl">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function JourneyEventCard({
  event,
  index,
  source,
}: {
  event: TraceEvent;
  index: number;
  source?: TraceSource;
}) {
  const location = [event.location_name, event.location_region, event.location_country]
    .filter(Boolean)
    .filter((value, valueIndex, values) => values.indexOf(value) === valueIndex)
    .join(', ');

  return (
    <li className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ecff64] font-mono text-xs font-bold text-[#171513]">
          {index + 1}
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {EVENT_LABELS[event.event_type] ?? event.event_type}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold leading-5 text-white">{event.title}</h3>
      {location && <p className="mt-2 text-xs text-white/55">{location}</p>}
      {event.description && (
        <p className="mt-2 text-xs leading-5 text-white/55">{event.description}</p>
      )}
      <div className="mt-4 border-t border-white/10 pt-3">
        <ValidationBadge status={event.validation_status} dark />
        {source && <p className="mt-2 truncate text-[10px] text-white/35">{source.publisher ?? source.title}</p>}
      </div>
    </li>
  );
}

function SourceRow({ source }: { source: TraceSource }) {
  const observed = source.observed_at
    ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(source.observed_at))
    : null;

  const content = (
    <div className="rounded-xl bg-white p-3">
      <p className="text-sm font-semibold text-[#1f1d1b]">{source.title}</p>
      <p className="mt-1 text-xs text-[#5d5853]">
        {[source.publisher, observed ? `${observed} gözlemi` : null].filter(Boolean).join(' · ')}
      </p>
    </div>
  );

  return source.source_url ? (
    <Link href={source.source_url} target="_blank" rel="noreferrer" className="block hover:opacity-75">
      {content}
    </Link>
  ) : content;
}

function EmptyEvidence({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#1f1d1b]/20 bg-[#fffdf8] p-5">
      <p className="text-sm font-semibold text-[#1f1d1b]">{title}</p>
      <p className="mt-2 text-xs leading-5 text-[#5d5853]">{description}</p>
    </div>
  );
}

function formatProtocol(protocol: string) {
  if (protocol === 'roaster_reported_legacy_score') return 'Kavurucu tarafından yayınlanan puan';
  return protocol.replaceAll('_', ' ');
}

function formatFieldName(fieldName: string) {
  return fieldName.replaceAll('_', ' ');
}

function formatClaimValue(value: unknown) {
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}
