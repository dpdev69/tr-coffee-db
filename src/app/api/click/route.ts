/** Legacy analytics intake is retired. V2 measures validated /go offer navigations. */
export async function POST() {
  return Response.json({ error: 'Bu uç nokta artık kullanılmıyor.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
