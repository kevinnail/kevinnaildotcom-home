// `size` drives the mosaic layout in CardGrid. The counts are deliberate — see
// the cell math in CardGrid.jsx before adding or removing a card.
const homeCards = [
  {
    title: 'Stress Less Glass',
    image: '/images/sherlock.jpg',
    href: 'https://stresslessglass.kevinnail.com',
    external: true,
    hoverBg: '/images/logo-sq.png',
    hoverFit: 'contain',
    // The hero title sits left, so the contained logo is pushed right to clear it.
    hoverPosition: 'right',
    size: 'hero',
  },
  {
    // `inspector` swaps the hover payoff for the devtools self-teardown in
    // InspectorOverlay. It replaced a 21MB screen-capture GIF, and is the only
    // card that opts in — on the photography tiles it would just be noise.
    title: 'Coding Portfolio',
    image: '/images/code.png',
    href: '/projects',
    external: false,
    inspector: true,
    size: 'hero',
  },
  {
    title: 'Backpacking',
    label: 'New',
    image: '/images/goat-lake.JPG',
    href: '/backpacking',
    external: false,
    hoverBg: '/images/flowers.JPEG',
    size: 'wide',
  },
  {
    title: 'Astrophotography',
    image: '/images/eclipse.JPG',
    href: '/astrophotography',
    external: false,
    hoverBg: '/images/lunar-sm.JPG',
    size: 'wide',
  },

  {
    title: 'My Music',
    image: '/images/drumset.jpeg',
    href: 'http://instagram.com/kevinnail_music',
    external: true,
    hoverBg: '/images/drumming.gif',
    size: 'tall',
  },
  {
    title: 'Good Morning Mushrooms',
    image: '/images/pinkoysters.jpg',
    href: 'http://www.instagram.com/good_morning_mushrooms',
    external: true,
    hoverBg: '/images/gmm.png',
    size: 'tall',
  },
  {
    title: 'About Kevin Nail',
    image: '/images/meHike.jpg',
    href: 'https://stresslessglass.kevinnail.com/about-me',
    external: true,
    hoverBg: '/images/kevin.png',
    size: 'hero',
  },
];

export default homeCards;
