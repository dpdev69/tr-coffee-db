import { publicCatalogCoffee } from '../../../../../shared/v2/public-catalog';
import { rankQuizMatches } from '../../../../../shared/v2/quiz-rank';
import { formatQuizReason, parseMatchLimit, parseQuizAnswers } from '@/lib/quiz-filters';
import { getCatalogDatabase } from '@/lib/v2-runtime';

const HEADERS = { 'Cache-Control': 'no-store' };
const MAX_QUERY = 1024;

/** GET /api/quiz/match?brew=filter&taste=Fruity,Floral&roast=light&process=washed&limit=4 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Bounded before parsing: no answer set needs more than a few hundred characters.
  if (url.search.length > MAX_QUERY) return Response.json({ error: 'Sorgu çok uzun.' }, { status: 400, headers: HEADERS });
  const answers = parseQuizAnswers(url.searchParams);
  const limit = parseMatchLimit(url.searchParams.get('limit'));
  try {
    const result = await rankQuizMatches(await getCatalogDatabase(), answers, limit);
    return Response.json({
      answers, exact: result.exact, total: result.total,
      coffees: result.coffees.map((coffee) => ({ ...publicCatalogCoffee(coffee), reasons: coffee.quizReasons.map(formatQuizReason) })),
    }, { headers: HEADERS });
  } catch {
    return Response.json({ error: 'Katalog şu anda yüklenemiyor.' }, { status: 503, headers: HEADERS });
  }
}
