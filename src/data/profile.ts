// Profile content: résumé, project summaries and 2026 self-assessment in documentation/.
// Prefer the newer delivery status and conservative attribution where sources differ.

import { YEARS_EXPERIENCE } from '../site';

export const INTRO = 'I help teams work through difficult technical decisions, make the trade-offs explicit and put those decisions into practice. I stay hands-on with design, code and review, sharing what I know and learning from the people closest to the problem.';

export const ABOUT_DESCRIPTION = `Clive Shirley is a Principal Software Engineer with ${YEARS_EXPERIENCE}+ years’ experience across healthcare, fintech, trading and legal technology, specialising in safe change in regulated systems.`;

export const AI_FOCUS = {
  before:
    'My current focus is delivery assurance for AI-assisted engineering: independent review, evidence against acceptance criteria and explicit release decisions. I architected an internal development harness at eMed and wrote',
  linkLabel: 'ACCORD',
  after:
    ', an open-source CLI and Pi extension for contract-led delivery. Alongside that tooling, I am researching delivery risk and proposing risk-tiered controls for regulated systems; those controls are not yet adopted policy.',
};

export const SUMMARY = [
  'I lead architecture across all engineering pillars for a healthcare platform operating in the UK, US and Canada, covering regulated patient data, prescribing and real payment flows.',
  'My specialism is safe change in regulated systems: payments, e-prescribing, FHIR interoperability, multi-jurisdiction data residency and AI-assisted delivery. I favour durable architecture over heroics and written reasoning over authority.',
  'Before healthcare I built white-label banking platforms for Lloyds Banking Group and RBS, ingested the entire Twitter firehose for trading firms, developed mobile trading apps at HSBC, and spent a decade in document and email management for the City’s leading law firms.',
];

export type Metric = { value: string; label: string; detail: string };

export const METRICS: Metric[] = [
  {
    value: 'One contract',
    label: 'pricing & checkout',
    detail: 'Replaced separate price configurations with a shared pricing API and shipped multi-account payment routing and a partner configuration portal.',
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
    title: 'AI-assisted engineering & delivery assurance',
    icon: 'spark',
    body: 'Contract-led workflows and independent review, alongside research into delivery risk and proposed controls for agent-built changes in regulated production.',
    tags: ['ACCORD', 'Independent review', 'Release evidence', 'Risk-tiered controls'],
  },
];

export const PRINCIPLES = [
  {
    title: 'Design grounded in delivery',
    body: 'Test architectural decisions against production behaviour, migration constraints and the experience of the people building and maintaining the system.',
  },
  {
    title: 'Written reasoning over authority',
    body: 'Record the options, evidence and trade-offs in design documents, RFCs and ADRs, so decisions can be challenged and revisited when circumstances change.',
  },
  {
    title: 'Build on what works',
    body: 'Start with established patterns and the team\'s experience. Make build-vs-buy decisions on evidence, and introduce something new when the problem warrants it.',
  },
  {
    title: 'Commercial-to-technical translation',
    body: 'Work with teams to turn commercial commitments into delivery options, making costs, risks and constraints explicit and labelling exploratory work honestly.',
  },
];

export const STACK: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript / Node', 'Ruby (Rails)', 'JavaScript', 'Python', 'Java', 'Go', 'Bash / shell', 'Lua (Neovim)'] },
  {
    group: 'Earlier career',
    items: ['C# / .NET', 'BlackBerry (Java)', 'Objective-C (iOS)', 'T-SQL', 'C / C++', 'ASP.NET', 'XSLT'],
  },
  {
    group: 'APIs & data',
    items: ['GraphQL (Apollo)', 'REST', 'HL7 FHIR', 'DynamoDB', 'OpenSearch', 'Postgres', 'MongoDB', 'Redis / Valkey', 'Kafka'],
  },
  {
    group: 'Platform',
    items: ['Kubernetes', 'Flux (GitOps)', 'AWS (KMS, SSM, Lambda, SNS/SQS)', 'Docker', 'Terraform', 'Nx monorepos', 'LocalStack', 'Tilt', 'Temporal', 'Camunda'],
  },
  { group: 'Identity & integrations', items: ['Auth0', 'OIDC / OAuth 2.0', 'SAML 2.0', 'Salesforce', 'NCPDP', 'X12'] },
  { group: 'Payments', items: ['Stripe', 'Braintree', 'BACS', 'Multi-provider adapters'] },
  { group: 'Testing & delivery', items: ['Jest', 'Vitest', 'Playwright', 'Cypress', 'k6', 'RSpec', 'Gherkin (BDD)', 'CI/CD', 'pre-commit', 'gitleaks'] },
  { group: 'Observability', items: ['OpenTelemetry', 'Datadog', 'Sentry', 'Metrics, tracing and logs'] },
  { group: 'Frontend', items: ['React', 'Next.js', 'Tailwind CSS', 'Radix UI', 'urql', 'Zod'] },
  { group: 'Agentic tooling', items: ['Pi', 'ACCORD', 'AGENTS.md', 'Bun', 'Biome'] },
  {
    group: 'Developer environment',
    items: ['Neovim', 'tmux', 'mosh', 'Ghostty', 'zsh / fish', 'ripgrep', 'fzf', 'GnuPG / pass', 'Astro'],
  },
];

export type Role = {
  company: string;
  note?: string;
  title: string;
  period: string;
  summary: string;
  highlights?: (string | Highlight)[];
};

export type Highlight = { text: string; href: string; label?: string };

export const EXPERIENCE: Role[] = [
  {
    company: 'eMed UK',
    note: 'continued Babylon’s UK business',
    title: 'Principal Software Engineer',
    period: 'Sep 2023 – present',
    summary:
      'Own technical strategy and architectural direction for a global healthcare platform. As architecture lead across all engineering pillars, set cross-cutting architecture, reference patterns and standards, and bridge commercial intent and technical delivery through B2B2C expansion, GLP-1 product lines, US and Canadian market entry and the Babylon legacy sunset.',
    highlights: [
      {
        text: 'Architected and shipped a payments domain replacing provider-coupled code with a pluggable adapter model, order orchestrator and configuration-driven pricing engine across US and UK surfaces.',
        href: '/payments/2026/07/22/one-list-price-many-coupons.html',
        label: 'Pricing standard: one list price, many coupons',
      },
      'Authored the pricing-plan standard (Stripe prices as list prices, every adjustment a coupon) and consolidated US checkout onto a single plan-configuration contract, ending pricing drift.',
      {
        text: 'Reviewed the design for in-house NHS e-prescription signing, covering key management, signing security and rollout risks. The team shipped the replacement for the third-party service.',
        href: '/architecture/2026/05/27/bringing-e-signing-in-house.html',
        label: 'Bringing e-signing in-house',
      },
      'Designed pharmacy claims submission and reconciliation with CVS, modelling NCPDP batches and X12 835 remittance natively in FHIR.',
      'Designed a reusable programme-hold model for US B2B pause and UK refill delay: time-bounded holds with declarative policies, layered over care plans.',
      {
        text: 'Used load tests to identify capacity limits and unsafe autoscaling, then designed admission control, bulkheads and fan-out budgets. The back-pressure prototype and wider stability work remain unfinished.',
        href: '/architecture/2026/02/11/load-testing-autoscaling-unsafe.html',
        label: 'Why load testing autoscaling is unsafe',
      },
      {
        text: 'Authored Canadian deployment and data-residency designs, separating in-country storage from processing boundaries. The broader progressive-jurisdiction architecture remains a proposal, not a completed rollout.',
        href: '/architecture/2026/09/02/data-residency-without-a-full-stack.html',
        label: 'Data residency without a full stack',
      },
      {
        text: 'Identified and remediated a critical cross-tenant authorisation vulnerability and led a platform-wide credential rotation programme.',
        href: '/engineering/2026/06/24/rotating-credentials-without-downtime.html',
        label: 'Rotating credentials without downtime',
      },
      'Built the first partner configuration portal, generating programme, pricing and organisation configuration PRs, then handed development to another engineer. Separately designed partner single sign-on and a config-driven app launcher.',
      'Authored the identity-provider build-vs-buy analysis that informed the decision to retain the incumbent rather than migrate. Commercial owners made the decision and handled renegotiation.',
      {
        text: 'Decommissioned a UK telehealth platform serving 4M+ patient records and migrated active Stripe subscriptions between accounts with runbooks, validation and rollback.',
        href: '/architecture/2025/04/16/decommissioning-a-telehealth-platform.html',
        label: 'Decommissioning a telehealth platform',
      },
      {
        text: 'Architected an internal agentic development harness used daily to shorten the spec-to-PR cycle, and authored the open-source ACCORD harness.',
        href: '/ai/2026/08/19/substrate-was-the-problem.html',
        label: 'Why the substrate was the problem',
      },
    ],
  },
  {
    company: 'Babylon Health',
    title: 'Principal Software Engineer',
    period: '2018 – Aug 2023',
    summary:
      'Set architectural direction and standards for the engineering organisation while hands-on in the core platform.',
    highlights: [
      'Helped modernise the core Ruby monolith into a multi-tenant microservices platform that scaled to serve 4M+ patients.',
      'Built a microservice-based integration hub for third-party insurers, speeding partner onboarding.',
      'Designed data-governance primitives for GDPR compliance, including jurisdictional data partitioning and automated key rotation.',
    ],
  },
  {
    company: 'Smarta',
    title: 'Lead Software Engineer',
    period: '2014 – 2018',
    summary:
      'Led in-house and offshore teams delivering white-label small-business SaaS for Lloyds Banking Group and RBS, combining architect and lead-engineer responsibilities.',
    highlights: [
      'Re-engineered a multi-tenant .NET estate to Ruby on Rails with full white-labelling for tier-one banks.',
      'Built a company-formation product integrating Companies House and HMRC XML gateways.',
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

export const IMPACT: { value: string; label: string }[] = [
  { value: '1K+', label: 'GDPR access and erasure requests, within SLA' },
  { value: '4M+', label: 'patients on the Babylon platform' },
  { value: 'Shared pricing', label: 'API and partner configuration portal in production' },
];

// Manually reviewed, not a build timestamp. Update when the work changes.
export const CURRENT_FOCUS = {
  reviewed: '2026-10-30',
  items: [
    {
      title: 'Agentic delivery assurance',
      status: 'Research & proposed controls',
      body: 'Studying where defects enter delivery and proposing risk-tiered review and release controls. ACCORD is a working tool, not evidence that the organisational policy has been adopted.',
    },
    {
      title: 'Progressive regional deployment',
      status: 'Proposed architecture',
      body: 'Developing a data-cell and processing-hub model for regional expansion, with explicit storage, processing and operational trade-offs. The proposal remains open for collaboration and decision.',
    },
    {
      title: 'Platform engineering',
      status: 'Delivered & in progress',
      body: 'Medley and the backend monorepo put the developer-experience strategy into practice. Work to let authorisation scale independently is in progress, not a completed production change.',
    },
  ],
};

export const LEADERSHIP = [
  {
    title: 'Architecture Guild and reference patterns',
    body: 'Set up a cross-functional guild and authored reusable patterns with template code (Strangler Fig, CQRS, Event-Driven, Adapter, Facade), built into onboarding and design-review checklists.',
  },
  {
    title: 'Ruby Guild',
    body: 'Revived the company-wide guild as a community of practice: performance tuning, TDD workshops, shared-library reviews and a backlog any engineer could add to.',
  },
  {
    title: 'Deep dives across teams',
    body: 'Cross-team sessions where one team walks another through its architecture. They break down silos and surface mismatched assumptions early.',
  },
  {
    title: 'Mentoring',
    body: 'One-to-ones, pairing and domain-design walk-throughs for engineers from junior to staff level, focused on architectural thinking as much as technique.',
  },
];

export const LEAD_STYLE = {
  title: 'A quiet kind of leadership',
  paragraphs: [
    'I lead by example and listen before I speak. Before offering a view, I want to understand the problem and hear from the people closest to it.',
    'When I do offer one, I show my working. I write down the options, the evidence and the trade-offs, in design documents, RFCs and ADRs, so a decision can be questioned, challenged and revisited long after the meeting has ended. A written case can be improved by anyone. A confident opinion mostly can’t.',
  ],
  reflection: {
    linkLabel: 'Standing on the shoulders of giants',
    href: 'https://plato.stanford.edu/entries/john-salisbury/',
    after: ' captures how I think about engineering. We build on other people\'s ideas, tools and experience. My contribution is to connect that knowledge to the problem in front of us, give credit and help the team leave something others can build on.',
  },
  points: [
    'Work alongside the team: stay hands-on with production code, incidents and migrations rather than directing from a distance.',
    'Make reasoning visible: record the why as well as the what, so the team can build on it.',
    'Label exploratory work honestly, so people can push back early.',
    'Share understanding through pairing and walk-throughs, learning from each other and leaving people room to find the answer themselves.',
    'Share credit for good outcomes and take responsibility for my part when things go wrong.',
  ],
};
