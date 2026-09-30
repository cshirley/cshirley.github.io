// Profile content, sourced from the résumé (documentation/3-resources/resume.md).

export const INTRO =
  'Principal Software Engineer with 30+ years shipping software, the last eight leading architecture at Babylon Health and eMed UK across a healthcare platform operating in the UK, US and Canada. I am a player-coach: I write the design doc, review the PRs, and still ship the hard fix when it matters.';

export const SUMMARY = [
  'I lead architecture across all engineering pillars for a healthcare platform operating in the UK, US and Canada, covering regulated patient data, prescribing and real payment flows.',
  'My specialism is safe change in regulated systems: payments, e-prescribing, FHIR interoperability, multi-jurisdiction data residency, and AI-assisted delivery. I favour durable architecture over heroics and written reasoning over authority.',
  'Before healthcare I built white-label banking platforms for Lloyds Banking Group and RBS, ingested the entire Twitter firehose for trading firms, built mobile trading apps at HSBC, and spent a decade in document and email management for the City’s leading law firms.',
];

export type Metric = { value: string; label: string; detail: string };

export const METRICS: Metric[] = [
  {
    value: '£310K',
    label: 'saved per year',
    detail: 'Replaced a third-party NHS ePrescription signing service with an in-house AES pipeline (~35K prescriptions a month).',
  },
  {
    value: '2 days → 30s',
    label: 'partner provisioning',
    detail: 'B2B onboarding automation across 700+ client organisations and ~3M members; setup errors cut from ~7% to under 1%.',
  },
  {
    value: '4M+',
    label: 'patient records',
    detail: 'Decommissioned a UK telehealth platform with GDPR-safe exports and an immutable, access-controlled media vault.',
  },
  {
    value: '70M+',
    label: 'messages a day',
    detail: 'Real-time Twitter firehose ingestion, ranking and anomaly detection for electronic trading firms at FSWire.',
  },
];

export type FocusArea = { title: string; icon: string; body: string; tags: string[] };

export const FOCUS_AREAS: FocusArea[] = [
  {
    title: 'Architecture & modernisation',
    icon: 'layers',
    body: 'Evolving monoliths into platforms without stopping the business, with decisions written down so they stay reviewable.',
    tags: ['ADRs', 'DDD', 'Strangler Fig', 'CQRS', 'Event-driven'],
  },
  {
    title: 'Payments & pricing',
    icon: 'card',
    body: 'Multi-provider, multi-region payment domains, configuration-driven pricing and zero-downtime provider migrations.',
    tags: ['Stripe', 'Braintree', 'BACS', 'Adapters', 'B2B2C'],
  },
  {
    title: 'Healthcare interoperability',
    icon: 'pulse',
    body: 'HL7 FHIR domain modelling, e-prescribing and signing, and pharmacy claims submission and reconciliation.',
    tags: ['HL7 FHIR', 'AES/PAdES', 'NCPDP', 'X12 835'],
  },
  {
    title: 'Scale & reliability',
    icon: 'gauge',
    body: 'Back-pressure, bulkheads, autoscaling signals, graceful shutdown, load testing and cost-aware architecture.',
    tags: ['Kubernetes', 'HPA', 'DynamoDB', 'Postgres', 'Kafka'],
  },
  {
    title: 'Security & data residency',
    icon: 'shield',
    body: 'Application security, credential rotation, GDPR operations and residency-clean, per-region stacks for new markets.',
    tags: ['GDPR', 'HIPAA-aligned', 'AWS KMS', 'OIDC/SAML'],
  },
  {
    title: 'Agentic & AI-assisted delivery',
    icon: 'spark',
    body: 'Harnesses, agent standards and skills catalogues that hold AI-generated PRs to the same checkable rules as human ones.',
    tags: ['ACCORD', 'Pi', 'Agent standards', 'CI enforcement'],
  },
];

export const PRINCIPLES = [
  {
    title: 'Architect-practitioner',
    body: 'Hands on production code, incidents and migrations while setting technical direction. Designs on the page, fixes in the repo.',
  },
  {
    title: 'Written reasoning over authority',
    body: 'Design documents, RFCs and ADRs that set platform standards and keep decisions reviewable long after the fact.',
  },
  {
    title: 'Credit outward, ownership inward',
    body: 'I grow engineers through pairing and domain walk-throughs, making reasoning visible rather than handing down answers.',
  },
  {
    title: 'Commercial-to-technical translation',
    body: 'Turning commitments into delivery plans, making build-vs-buy calls on evidence, and labelling exploratory work honestly.',
  },
];

export const STACK: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript / Node', 'Ruby (Rails)', 'JavaScript'] },
  {
    group: 'APIs & data',
    items: ['GraphQL', 'REST', 'HL7 FHIR', 'DynamoDB', 'OpenSearch', 'Postgres', 'MongoDB', 'Redis / Valkey', 'Kafka'],
  },
  {
    group: 'Platform',
    items: ['Kubernetes', 'AWS (KMS, SSM, Lambda, SNS/SQS)', 'Docker', 'Terraform', 'Temporal', 'Camunda'],
  },
  { group: 'Identity & integrations', items: ['Auth0', 'OIDC / OAuth 2.0', 'SAML 2.0', 'Salesforce', 'NCPDP', 'X12'] },
  { group: 'Payments', items: ['Stripe', 'Braintree', 'BACS', 'Multi-provider adapters'] },
  { group: 'Tooling', items: ['Jest', 'RSpec', 'CI/CD', 'Observability (metrics, tracing, logs)'] },
];

export type Role = {
  company: string;
  note?: string;
  title: string;
  period: string;
  summary: string;
  highlights?: string[];
};

export const EXPERIENCE: Role[] = [
  {
    company: 'eMed UK',
    note: 'formerly Babylon Health',
    title: 'Principal Software Engineer',
    period: '2018 – present',
    summary:
      'Own technical strategy and architectural direction for a global healthcare platform. Principal Engineer across all product pillars, setting cross-cutting architecture, reference patterns and standards, and bridging commercial intent and technical delivery through B2B2C expansion, GLP-1 product lines, US and Canadian market entry and the Babylon legacy sunset.',
    highlights: [
      'Architected and shipped a payments domain replacing provider-coupled code with a pluggable adapter model, order orchestrator and configuration-driven pricing engine across US and UK surfaces.',
      'Brought NHS ePrescription signing in-house: per-prescriber AWS KMS keys, PAdES-signed PDFs and a feature-flagged rollout, saving ~£310K a year.',
      'Designed pharmacy claim submission and reconciliation with CVS, modelling NCPDP batches and X12 835 remittance natively in FHIR.',
      'Led the multi-quarter stability and scaling programme: back-pressure, bulkheads, circuit breakers, graceful shutdown and a performance-testing framework.',
      'Set the Canadian deployment architecture and a data-cell pattern that keeps at-rest patient data in-country for residency-constrained markets.',
      'Identified and remediated a critical cross-tenant authorisation vulnerability and led a platform-wide credential rotation programme.',
      'Architected an internal agentic development harness used daily to shorten the spec-to-PR cycle; author of the open-source ACCORD.',
      'Modernised the core Ruby monolith into a multi-tenant microservices platform and scaled it to 30K+ active customers with headroom for 5–10x growth.',
    ],
  },
  {
    company: 'Smarta',
    title: 'Lead Software Engineer',
    period: '2014 – 2018',
    summary:
      'Led in-house and offshore teams delivering white-label small-business SaaS for Lloyds Banking Group and RBS, combining architect and lead-engineer responsibilities.',
    highlights: [
      'Re-engineered a multi-tenanted .NET estate to Ruby on Rails with full white-labelling for tier-one banks.',
      'Built a company-formations product integrating Companies House and HMRC XML gateways.',
      'Delivered SSO and provisioning integrations with Sage, FreeAgent, LivePlan and Salesforce.',
    ],
  },
  {
    company: 'FSWire',
    title: 'Principal Software Engineer',
    period: '2011 – 2014',
    summary:
      'Led engineering end to end for a real-time social and market data platform serving high-frequency and electronic trading firms.',
    highlights: [
      'Ingested the full Twitter firehose: 70M+ messages a day, ~2,500/s bursts and 800,000 standing queries.',
      'Ranked content for relevance and surfaced sentiment shifts and volume anomalies as candidate trading indicators.',
      'Shipped mobile and tablet clients plus REST and streaming APIs.',
    ],
  },
  {
    company: 'HSBC',
    title: 'Senior Mobile Engineer',
    period: '2009 – 2011',
    summary: 'Designed and engineered a BlackBerry FX messaging and trading application.',
  },
  {
    company: 'Interwoven',
    note: 'acquired by Autonomy',
    title: 'Principal Software Engineer',
    period: '2006 – 2009',
    summary:
      'Led the iManage WorkSite mobile team, engineered the WorkSite FileShare prototype and led the team behind server-based email management for the WorkSite suite.',
  },
  {
    company: 'Progressive Mobile Systems',
    title: 'Founder & Principal Engineer',
    period: '2005 – 2006',
    summary:
      'Built mobile workforce and legal email management solutions; the company’s assets were acquired by Interwoven.',
  },
  {
    company: 'Freelance',
    title: 'Systems integration & software development',
    period: '1998 – 2005',
    summary:
      'Document, content, knowledge and email management and enterprise search for the financial and legal sectors, including Allen & Overy, Freshfields, Linklaters, Lovells and Slaughter and May.',
  },
  {
    company: 'Resolution Systems',
    title: 'Team Lead',
    period: '1992 – 1998',
    summary: 'Delivered document and email management solutions for legal and financial clients.',
  },
];

export const EDUCATION = { school: 'City University, London', degree: 'BSc (Hons) Computer Science', period: '1990 – 1994' };
