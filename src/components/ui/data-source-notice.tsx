import Link from 'next/link';

export function DataSourceNotice({
  actionHref,
  actionLabel,
  message,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  title: string;
}) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-line bg-tint p-4 text-left"
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-3 inline-flex text-sm font-semibold text-ink underline-offset-4 transition-colors hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
