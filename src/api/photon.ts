/**
 * Location autocomplete via Photon (Komoot) — OSM-backed, free for fair use.
 * Prefer this for typeahead; keep Nominatim for one-shot geocode only.
 *
 * Important: do NOT filter by browser locale country. `en`/`en-US` maximize to
 * US and would hide Canadian (and other) results. Prefer timezone/GPS bias and
 * only hard-filter country when the query itself implies one (postal/ZIP).
 */

export interface PlaceSuggestion {
  id: string
  label: string
  lat: number
  lng: number
  postcode?: string
  countrycode?: string
}

interface PhotonFeature {
  type?: string
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    osm_id?: number
    osm_type?: string
    osm_key?: string
    osm_value?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    district?: string
    locality?: string
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

/** Province/territory → postal abbreviation (Canada). */
const CA_REGION_ABBR: Record<string, string> = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT',
  'Nova Scotia': 'NS',
  Nunavut: 'NU',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC',
  Québec: 'QC',
  Saskatchewan: 'SK',
  Yukon: 'YT',
}

/** US state full name → abbreviation (common Photon values). */
const US_REGION_ABBR: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
}

const CA_TIMEZONES = new Set([
  'America/Toronto',
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Halifax',
  'America/St_Johns',
  'America/Montreal',
  'America/Regina',
  'America/Whitehorse',
  'America/Yellowknife',
  'America/Iqaluit',
  'America/Goose_Bay',
  'America/Moncton',
  'America/Glace_Bay',
  'America/Blanc-Sablon',
  'America/Cambridge_Bay',
  'America/Creston',
  'America/Dawson',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Inuvik',
  'America/Nipigon',
  'America/Pangnirtung',
  'America/Rainy_River',
  'America/Rankin_Inlet',
  'America/Resolute',
  'America/Swift_Current',
  'America/Thunder_Bay',
])

/** Canadian postal: A1A 1A1 (space optional). */
const CA_POSTAL_RE =
  /\b([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)\b/

function locality(props: NonNullable<PhotonFeature['properties']>): string {
  return (
    props.city ||
    props.town ||
    props.village ||
    props.municipality ||
    props.locality ||
    props.district ||
    ''
  )
}

function regionAbbr(
  state: string | undefined,
  countrycode: string | undefined,
): string {
  if (!state) return ''
  const cc = (countrycode || '').toUpperCase()
  if (cc === 'CA') return CA_REGION_ABBR[state] || state
  if (cc === 'US') return US_REGION_ABBR[state] || state
  return state
}

function formatPostcode(
  postcode: string | undefined,
  countrycode: string | undefined,
): string {
  if (!postcode) return ''
  const cc = (countrycode || '').toUpperCase()
  if (cc === 'CA') {
    const m = CA_POSTAL_RE.exec(postcode.replace(/\s+/g, ''))
    if (m) return `${m[1]!.toUpperCase()} ${m[2]!.toUpperCase()}`
    return postcode.toUpperCase()
  }
  return postcode
}

/**
 * Human-readable label including postal/ZIP when Photon provides one —
 * useful for verifying the right hit. Country is always shown.
 */
export function formatPhotonLabel(
  props: NonNullable<PhotonFeature['properties']>,
): string {
  const parts: string[] = []
  const cc = (props.countrycode || '').toUpperCase()
  const postcode = formatPostcode(props.postcode, props.countrycode)

  if (props.housenumber && props.street) {
    parts.push(`${props.housenumber} ${props.street}`)
  } else if (props.street) {
    parts.push(props.street)
  } else if (props.name) {
    parts.push(props.name)
  }

  const city = locality(props)
  if (city && !parts.includes(city)) parts.push(city)

  const region = regionAbbr(props.state, props.countrycode)

  // CA: "Toronto, ON M5H 2N1" · US: "Austin, TX 78701" · else: "State, postcode"
  if (region && region !== city) {
    if (postcode && (cc === 'CA' || cc === 'US')) {
      parts.push(`${region} ${postcode}`)
    } else {
      parts.push(region)
      if (postcode) parts.push(postcode)
    }
  } else if (postcode) {
    parts.push(postcode)
  }

  if (props.country && !parts.includes(props.country)) {
    parts.push(props.country)
  } else if (cc && !props.country) {
    parts.push(cc)
  }

  if (parts.length === 0 && props.name) return props.name
  return parts.filter(Boolean).join(', ')
}

function featureToSuggestion(
  feature: PhotonFeature,
  index: number,
): PlaceSuggestion | null {
  const coords = feature.geometry?.coordinates
  const props = feature.properties
  if (!coords || !props) return null

  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const label = formatPhotonLabel(props)
  if (!label.trim()) return null

  const id =
    props.osm_type && props.osm_id != null
      ? `${props.osm_type}:${props.osm_id}`
      : `photon-${lat},${lng}-${index}`

  return {
    id,
    label,
    lat,
    lng,
    postcode: props.postcode
      ? formatPostcode(props.postcode, props.countrycode) || props.postcode
      : undefined,
    countrycode: props.countrycode?.toUpperCase(),
  }
}

async function photonFetch(path: string): Promise<PlaceSuggestion[]> {
  const res = await fetch(`https://photon.komoot.io${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []

  const data = (await res.json()) as PhotonResponse
  const features = data.features ?? []
  const seen = new Set<string>()
  const out: PlaceSuggestion[] = []

  for (let i = 0; i < features.length; i++) {
    const suggestion = featureToSuggestion(features[i]!, i)
    if (!suggestion) continue
    if (seen.has(suggestion.id) || seen.has(suggestion.label)) continue
    seen.add(suggestion.id)
    seen.add(suggestion.label)
    out.push(suggestion)
  }

  return out
}

/** Rough map-center bias from timezone when we lack GPS. */
function timezoneBias(): { lat: number; lon: number; country?: string } | null {
  if (typeof Intl === 'undefined') return null
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return null
  }

  const centers: Record<string, { lat: number; lon: number; country?: string }> =
    {
      'America/Toronto': { lat: 43.65, lon: -79.38, country: 'CA' },
      'America/Vancouver': { lat: 49.28, lon: -123.12, country: 'CA' },
      'America/Edmonton': { lat: 53.55, lon: -113.49, country: 'CA' },
      'America/Winnipeg': { lat: 49.9, lon: -97.14, country: 'CA' },
      'America/Halifax': { lat: 44.65, lon: -63.57, country: 'CA' },
      'America/St_Johns': { lat: 47.56, lon: -52.71, country: 'CA' },
      'America/Montreal': { lat: 45.5, lon: -73.57, country: 'CA' },
      'America/Regina': { lat: 50.45, lon: -104.61, country: 'CA' },
      'America/Whitehorse': { lat: 60.72, lon: -135.05, country: 'CA' },
      'America/Yellowknife': { lat: 62.45, lon: -114.37, country: 'CA' },
      'America/Iqaluit': { lat: 63.75, lon: -68.52, country: 'CA' },
      'America/New_York': { lat: 40.71, lon: -74.01, country: 'US' },
      'America/Chicago': { lat: 41.88, lon: -87.63, country: 'US' },
      'America/Denver': { lat: 39.74, lon: -104.99, country: 'US' },
      'America/Los_Angeles': { lat: 34.05, lon: -118.24, country: 'US' },
    }

  if (centers[tz]) return centers[tz]!
  if (CA_TIMEZONES.has(tz)) {
    return { lat: 43.65, lon: -79.38, country: 'CA' }
  }
  return null
}

/** Infer country only from what the user typed — never from browser locale. */
function countryFromQuery(query: string): string | null {
  const q = query.trim()

  // Canadian postal code present (A1A 1A1)
  if (CA_POSTAL_RE.test(q)) return 'CA'

  // Pure US ZIP (5 digits, optionally +4)
  if (/^\d{5}(?:-\d{4})?$/.test(q)) return 'US'

  if (
    /\b(canada|ontario|quebec|québec|alberta|manitoba|saskatchewan|yukon|nunavut)\b/i.test(
      q,
    )
  ) {
    return 'CA'
  }
  if (
    /\b(british columbia|nova scotia|new brunswick|newfoundland|prince edward)\b/i.test(
      q,
    )
  ) {
    return 'CA'
  }
  if (/\b(ON|BC|AB|MB|SK|QC|NS|NB|NL|PE|NT|NU|YT)\b/.test(q)) return 'CA'

  if (/\b(united states|usa|u\.s\.a\.?)\b/i.test(q)) return 'US'

  return null
}

function preferCountry(
  results: PlaceSuggestion[],
  country: string | undefined,
): PlaceSuggestion[] {
  if (!country || results.length === 0) return results
  const preferred = results.filter((r) => r.countrycode === country)
  const rest = results.filter((r) => r.countrycode !== country)
  // Soft rank only — never drop other countries.
  return preferred.length > 0 ? [...preferred, ...rest] : results
}

export interface SearchPlacesOptions {
  /** Prefer results near this point (GPS). */
  bias?: { lat: number; lng: number } | null
  /** Explicit country filter from the caller (optional). */
  countrycode?: string | null
}

/** Debounce-friendly forward search for the location typeahead. */
export async function searchPlaces(
  query: string,
  limit = 6,
  options: SearchPlacesOptions = {},
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const queryCountry = countryFromQuery(trimmed)
  // Only hard-filter when the query itself implies a country (postal/ZIP/name).
  // Never use browser locale — that locked Canadians on en-US to US-only results.
  const hardCountry =
    options.countrycode?.toUpperCase() || queryCountry || undefined

  const tz = timezoneBias()
  const bias = options.bias
    ? { lat: options.bias.lat, lng: options.bias.lng }
    : tz
      ? { lat: tz.lat, lng: tz.lon }
      : null

  const prefer =
    hardCountry ||
    (options.bias ? undefined : tz?.country) ||
    undefined

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(Math.max(limit * 2, 10)),
    lang: 'en',
  })

  if (hardCountry) params.append('countrycode', hardCountry)

  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    params.set('lat', String(bias.lat))
    params.set('lon', String(bias.lng))
    // Stronger bias toward nearby results without excluding other countries.
    params.set('location_bias_scale', '0.2')
    params.set('zoom', '12')
  }

  let results = await photonFetch(`/api?${params}`)

  // If a postal/ZIP hard filter returned nothing, retry without it.
  if (results.length === 0 && hardCountry) {
    const fallback = new URLSearchParams({
      q: trimmed,
      limit: String(Math.max(limit * 2, 10)),
      lang: 'en',
    })
    if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
      fallback.set('lat', String(bias.lat))
      fallback.set('lon', String(bias.lng))
      fallback.set('location_bias_scale', '0.2')
      fallback.set('zoom', '12')
    }
    results = await photonFetch(`/api?${fallback}`)
  }

  return preferCountry(results, prefer).slice(0, limit)
}

/** Resolve browser coordinates to a selectable place suggestion. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<PlaceSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    lang: 'en',
  })

  const results = await photonFetch(`/reverse?${params}`)
  return results[0] ?? null
}
