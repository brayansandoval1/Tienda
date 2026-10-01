import type { NextRequest } from 'next/server';
import openmoji from '@iconify-json/openmoji/icons.json';
import fluentEmoji from '@iconify-json/fluent-emoji-flat/icons.json';
import materialDesign from '@iconify-json/mdi/icons.json';
import brandLogos from '@iconify-json/logos/icons.json';

type IconData = { body: string; width?: number; height?: number };
type IconSetData = { prefix: string; width?: number; height?: number; icons: Record<string, IconData> };
const ICON_SETS: IconSetData[] = [openmoji, fluentEmoji, materialDesign, brandLogos];
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SEARCH_INDEX = ICON_SETS.flatMap((set) => Object.entries(set.icons).map(([name, icon]) => ({
  prefix: set.prefix,
  name,
  icon,
  width: icon.width ?? set.width ?? 24,
  height: icon.height ?? set.height ?? 24,
  normalized: `${set.prefix} ${name}`.toLocaleLowerCase().replace(/[-_]/g, ' '),
}))).sort((a, b) => a.name.localeCompare(b.name));

function allowedPrefixes(raw: string | null) {
  if (!raw) return null;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function prefixMatches(prefix: string, filters: string[] | null) {
  return !filters || filters.some((filter) => prefix === filter || prefix.startsWith(filter.endsWith('-') ? filter : `${filter}-`));
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length || path.some((segment) => !SAFE_PATH_SEGMENT.test(segment))) {
    return Response.json({ error: 'Invalid icon resource path.' }, { status: 400 });
  }

  if (path.join('/') === 'search') {
    const query = request.nextUrl.searchParams.get('query')?.trim().toLocaleLowerCase() ?? '';
    const prefixes = allowedPrefixes(request.nextUrl.searchParams.get('prefixes') ?? request.nextUrl.searchParams.get('prefix'));
    const limit = Math.max(1, Math.min(96, Number(request.nextUrl.searchParams.get('limit')) || 48));
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = terms.length ? SEARCH_INDEX.flatMap((entry) => {
      if (!prefixMatches(entry.prefix, prefixes)) return [];
      const score = terms.reduce((best, term) => {
        if (entry.name === term) return Math.max(best, 100);
        if (entry.name.startsWith(term)) return Math.max(best, 70);
        if (entry.normalized.includes(term)) return Math.max(best, 40);
        return best;
      }, 0);
      return score ? [{ entry, score }] : [];
    }).sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name)) : [];
    const icons = matches.slice(0, limit).map(({ entry }) => `${entry.prefix}:${entry.name}`);
    return Response.json({
      icons,
      total: matches.length,
      limit,
      start: 0,
      collections: Object.fromEntries(ICON_SETS.map((set) => [set.prefix, { name: set.prefix }])),
      request: { query, limit: String(limit), ...(prefixes ? { prefixes: prefixes.join(',') } : {}) },
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } });
  }

  const svgPath = path.join('/');
  if (!svgPath.endsWith('.svg')) return Response.json({ error: 'Unsupported icon resource.' }, { status: 404 });
  const [prefix, ...nameParts] = svgPath.slice(0, -4).split('/');
  const name = nameParts.join('/');
  const set = ICON_SETS.find((item) => item.prefix === prefix);
  const icon = set?.icons[name];
  if (!set || !icon) return Response.json({ error: 'Icon not found in the bundled libraries.' }, { status: 404 });

  const width = icon.width ?? set.width ?? 24;
  const height = icon.height ?? set.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  });
}
