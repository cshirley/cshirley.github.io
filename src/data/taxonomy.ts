/**
 * Allowed post categories and tags, enforced by the content schema (src/content.config.ts).
 *
 * Categories are part of every post URL (/<category>/<yyyy>/<mm>/<dd>/<slug>.html), so adding
 * or renaming one changes URLs; `npm run check:urls` catches any published URL that disappears.
 *
 * To use a new tag, add it here first. Check for an existing near-match (case, plural) before
 * adding, so the tag list stays consistent.
 */
export const CATEGORIES = [
  'AI',
  'Architecture',
  'Business',
  'Consultancy',
  'Development',
  'Engineering',
  'FSWire',
  'Payments',
] as const;

export const TAGS = [
  'ACCORD', 'agentic engineering', 'AGENTS.md', 'AI agents', 'architecture', 'async', 'auditing',
  'AWS', 'AWS KMS', 'B2B', 'build vs buy', 'Camunda', 'capacity planning', 'CI', 'Claude Code',
  'Cloud', 'compliance', 'configuration', 'consumer protection', 'cost', 'CQRS', 'data contracts',
  'data integration', 'data migration', 'data residency', 'DDD', 'decision making',
  'decommissioning', 'developer experience', 'discounts', 'distributed systems', 'divestiture',
  'domain modelling', 'dotfiles', 'DynamoDB', 'e-signatures', 'ECS', 'engineering standards',
  'ETL', 'focus', 'fulfilment', 'GDPR', 'healthcare', 'HL7 FHIR', 'idempotency', 'identity',
  'incidents', 'integration patterns', 'iPad', 'keyboards', 'Kubernetes', 'load testing',
  'local development', 'migrations', 'mobile', 'monorepo', 'mosh', 'multi-region',
  'multi-tenancy', 'NCPDP', 'Neovim', 'NGINX', 'Node.js', 'OAuth 2.0', 'OpenSearch', 'ovh',
  'PAdES', 'patterns', 'payments', 'Pi', 'PKCE', 'platform engineering', 'Postgres',
  'preview environments', 'pricing', 'privacy', 'productivity', 'React Native', 'refactoring',
  'reliability', 'RFC', 'Ruby', 'SAML', 'scaling', 'secrets management', 'security', 'SOLID',
  'specifications', 'ssh', 'strangler fig', 'Stripe', 'subscriptions', 'TDD', 'Temporal', 'Tilt',
  'tmux', 'tooling', 'transactional outbox', 'twitter', 'TypeScript', 'USP', 'vendor evaluation',
  'vim', 'vps', 'webhooks', 'workflow orchestration', 'workflows', 'X12 835',
] as const;

/** Posts dated before this predate descriptions (legacy Jekyll posts) and are exempt. */
export const DESCRIPTION_REQUIRED_FROM = new Date('2016-01-01T00:00:00Z');
export const DESCRIPTION_MIN = 80;
export const DESCRIPTION_MAX = 320;
