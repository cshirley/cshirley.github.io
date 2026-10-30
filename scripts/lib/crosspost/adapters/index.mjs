// Explicit registry of supported destinations. Adding one means a new adapter module, an entry
// here, credential wiring, contract tests and a reviewed baseline for its existing articles.
import { linkedin } from './linkedin.mjs';
import { medium } from './medium.mjs';

export const ADAPTERS = { medium, linkedin };
