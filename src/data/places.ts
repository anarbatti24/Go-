/**
 * Hardcoded sample places for Go!
 *
 * Vision: the Feed should feel like a real city discovery stream on day one —
 * no empty states while browsing. These 20 places are the entire "backend"
 * content for now. Images are portrait (720×1280) so they fill a phone reel.
 *
 * Tips for tinkering:
 * - Change a `seed` in the picsum URL to get a different photo for that place.
 * - Add more places by copying an object and giving it a unique `id`.
 * - Later, replace this array with an API fetch and keep the same `Place` shape.
 */

import type { Place } from '../types'

/** Seed catalog loaded into the Zustand store as `places`. */
export const samplePlaces: Place[] = [
  {
    id: '1',
    name: 'Harborview Café',
    description:
      'A bright waterfront café serving specialty coffee, fresh pastries, and light brunch plates with marina views.',
    image: 'https://picsum.photos/seed/harborview/720/1280',
    price: 2,
    distance: '0.4 mi',
    location: '12 Pier Lane',
    category: 'Café',
  },
  {
    id: '2',
    name: 'Neon Noodle Bar',
    description:
      'Late-night ramen spot with rich broths, crispy pork, and a neon-lit dining room that buzzes until midnight.',
    image: 'https://picsum.photos/seed/neonnoodle/720/1280',
    price: 2,
    distance: '0.8 mi',
    location: '88 Market Street',
    category: 'Asian',
  },
  {
    id: '3',
    name: 'Summit Trail Overlook',
    description:
      'Scenic hiking viewpoint with panoramic city and canyon views—perfect for sunset photos and picnic blankets.',
    image: 'https://picsum.photos/seed/summittrail/720/1280',
    price: 1,
    distance: '3.2 mi',
    location: 'Ridge Road Trailhead',
    category: 'Outdoors',
  },
  {
    id: '4',
    name: 'Velvet Room Speakeasy',
    description:
      'Hidden cocktail lounge behind a bookstore façade. Craft drinks, plush booths, and live jazz on weekends.',
    image: 'https://picsum.photos/seed/velvetroom/720/1280',
    price: 3,
    distance: '1.1 mi',
    location: '45 Elm Court (ask for Velvet)',
    category: 'Nightlife',
  },
  {
    id: '5',
    name: 'Green Leaf Market',
    description:
      'Farm-to-table grocery and tasting counter featuring local produce, artisan cheese, and rotating food trucks.',
    image: 'https://picsum.photos/seed/greenleaf/720/1280',
    price: 2,
    distance: '0.6 mi',
    location: '210 Grove Avenue',
    category: 'Market',
  },
  {
    id: '6',
    name: 'Bluebird Bowling Alley',
    description:
      'Retro bowling lanes with craft beer, arcade games, and shareable pizza—great for group nights out.',
    image: 'https://picsum.photos/seed/bluebirdbowl/720/1280',
    price: 2,
    distance: '2.0 mi',
    location: '500 Lane Drive',
    category: 'Entertainment',
  },
  {
    id: '7',
    name: 'Casa Sol Kitchen',
    description:
      'Warm Mexican kitchen known for handmade tortillas, smoky salsa flight, and sunny patio seating.',
    image: 'https://picsum.photos/seed/casasol/720/1280',
    price: 2,
    distance: '1.4 mi',
    location: '77 Sol Street',
    category: 'Mexican',
  },
  {
    id: '8',
    name: 'Aurora Art Gallery',
    description:
      'Contemporary gallery showcasing emerging local artists, with monthly openings and a quiet sculpture garden.',
    image: 'https://picsum.photos/seed/auroraart/720/1280',
    price: 1,
    distance: '1.7 mi',
    location: '19 Canvas Way',
    category: 'Arts',
  },
  {
    id: '9',
    name: 'Ember & Oak Steakhouse',
    description:
      'Upscale steakhouse with wood-fired cuts, an extensive wine list, and intimate booth dining.',
    image: 'https://picsum.photos/seed/emberoak/720/1280',
    price: 4,
    distance: '2.5 mi',
    location: '301 Oak Boulevard',
    category: 'Fine Dining',
  },
  {
    id: '10',
    name: 'Wavepool Surf Club',
    description:
      'Indoor wave pool and surf lessons for all levels, plus a beachy café serving smoothies and tacos.',
    image: 'https://picsum.photos/seed/wavepool/720/1280',
    price: 3,
    distance: '4.1 mi',
    location: '900 Coast Highway',
    category: 'Activity',
  },
  {
    id: '11',
    name: 'Maple Street Bakery',
    description:
      'Neighborhood bakery famous for cinnamon rolls, sourdough loaves, and seasonal fruit tarts.',
    image: 'https://picsum.photos/seed/maplebakery/720/1280',
    price: 1,
    distance: '0.3 mi',
    location: '5 Maple Street',
    category: 'Bakery',
  },
  {
    id: '12',
    name: 'Kinetic Climbing Gym',
    description:
      'Modern bouldering and top-rope gym with beginner-friendly routes, gear rental, and a chill lounge.',
    image: 'https://picsum.photos/seed/kineticclimb/720/1280',
    price: 2,
    distance: '2.8 mi',
    location: '64 Ascend Road',
    category: 'Fitness',
  },
  {
    id: '13',
    name: 'Lantern Night Market',
    description:
      'Open-air night market with street food stalls, handmade crafts, and string lights after dusk.',
    image: 'https://picsum.photos/seed/lanternmarket/720/1280',
    price: 1,
    distance: '1.9 mi',
    location: 'Plaza Central',
    category: 'Market',
  },
  {
    id: '14',
    name: 'Copper Pot Bistro',
    description:
      'Cozy French-inspired bistro serving seasonal plates, house wines, and a standout crème brûlée.',
    image: 'https://picsum.photos/seed/copperpot/720/1280',
    price: 3,
    distance: '1.2 mi',
    location: '28 Copper Lane',
    category: 'Bistro',
  },
  {
    id: '15',
    name: 'Starlight Cinema',
    description:
      'Independent cinema with plush recliners, curated indie films, and a lobby bar with local beer.',
    image: 'https://picsum.photos/seed/starlightcinema/720/1280',
    price: 2,
    distance: '1.5 mi',
    location: '100 Reel Avenue',
    category: 'Entertainment',
  },
  {
    id: '16',
    name: 'Riverbend Picnic Park',
    description:
      'Riverside park with shady lawns, walking paths, and paddleboat rentals—ideal for casual hangouts.',
    image: 'https://picsum.photos/seed/riverbend/720/1280',
    price: 1,
    distance: '2.3 mi',
    location: 'Riverbend Drive',
    category: 'Outdoors',
  },
  {
    id: '17',
    name: 'Saffron Spice House',
    description:
      'Vibrant Indian restaurant featuring thali platters, fragrant curries, and soft naan fresh from the tandoor.',
    image: 'https://picsum.photos/seed/saffronspice/720/1280',
    price: 2,
    distance: '0.9 mi',
    location: '55 Spice Row',
    category: 'Indian',
  },
  {
    id: '18',
    name: 'Cloud Nine Rooftop',
    description:
      'Skyline rooftop bar with citrus cocktails, small plates, and golden-hour city views.',
    image: 'https://picsum.photos/seed/cloudnine/720/1280',
    price: 3,
    distance: '1.6 mi',
    location: '12th Floor, 400 High Street',
    category: 'Nightlife',
  },
  {
    id: '19',
    name: 'Pine & Petal Florist Café',
    description:
      'Flower shop café hybrid—sip matcha among bouquets, then take home a seasonal arrangement.',
    image: 'https://picsum.photos/seed/pinepetal/720/1280',
    price: 2,
    distance: '0.7 mi',
    location: '33 Petal Court',
    category: 'Café',
  },
  {
    id: '20',
    name: 'Echo Chamber Arcade',
    description:
      'Vintage and modern arcade with pinball tournaments, VR pods, and bottomless soda for groups.',
    image: 'https://picsum.photos/seed/echoarcade/720/1280',
    price: 2,
    distance: '2.1 mi',
    location: '150 Game Lane',
    category: 'Entertainment',
  },
]
