import { permanentRedirect } from 'next/navigation';
export default async function LegacyDetail({ params }: { params: Promise<{slug:string}> }) {
  const {slug}=await params;
  permanentRedirect(`/kavurucu/${encodeURIComponent(slug)}`);
}
