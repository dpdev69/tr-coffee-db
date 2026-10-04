/** Legacy form is not exposed in V2; never write reports into the rollback database. */
export async function POST() {
  return Response.json({ error: 'Bu form artık kullanılmıyor. İletişim bağlantısını kullanabilirsin.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
