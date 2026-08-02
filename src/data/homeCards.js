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
    size: 'hero',
  },
  {
    title: 'Coding Portfolio',
    image: '/images/code.png',
    href: '/projects',
    external: false,
    hoverBg: '/images/cube.gif',
    hoverFit: 'contain',
    size: 'hero',
  },
  {
    title: 'Backpacking',
    eyebrow: 'New',
    blurb: 'Trips and trail photos on an interactive 3D globe',
    image: '/images/meHike.jpg',
    href: '/backpacking',
    external: false,
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
