// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.shirleyconsulting.co.uk',
  // Mirror Jekyll's output layout so existing URLs keep working:
  //   src/pages/about/index.astro -> /about/index.html
  //   posts                       -> /fswire/2013/01/01/slug.html
  build: { format: 'preserve', inlineStylesheets: 'always' },
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid', 'math'] },
    // github-dark-default keeps comment tokens above WCAG AA contrast
    shikiConfig: { theme: 'github-dark-default', wrap: false },
  },
  vite: {
    // mermaid is lazy-loaded only on posts with diagrams
    build: { chunkSizeWarningLimit: 3000 },
  },
  // Retired pages from the old consultancy site.
  redirects: {
    '/projects/index': '/about/',
    '/projects/2013-05-01-fwsire': '/about/',
    '/projects/2015-11-01-lloyds-bank-business-toolbox': '/about/',
    '/elements/index': '/',
    '/generic/index': '/',
  },
});
