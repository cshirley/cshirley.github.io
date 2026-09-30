export const SITE = {
  name: 'Clive Shirley',
  title: 'Clive Shirley · Principal Software Engineer',
  role: 'Principal Software Engineer',
  description:
    'Principal Software Engineer and architect-practitioner. 30+ years shipping software, specialising in safe change in regulated systems: payments, healthcare interoperability, multi-region platforms and AI-assisted delivery.',
  location: 'Hampshire, UK',
  email: 'clive.shirley@mac.com',
  links: {
    github: 'https://github.com/cshirley',
    linkedin: 'https://www.linkedin.com/in/cliveshirley',
    accord: 'https://github.com/cshirley/accord',
  },
  // Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX"); empty = no tracking.
  gaMeasurementId: 'G-CB3EKHBYF8',
} as const;

export type NavItem = { title: string; url: string };

export const NAV: NavItem[] = [
  { title: 'About', url: '/about/' },
  { title: 'Writing', url: '/blog/' },
  { title: 'Contact', url: '/contact/' },
];
