// Editorial summaries of the articles' conclusions, not automatic extracts.
// Keep one lesson per article. Source titles and URLs come from post metadata.
// cspell:ignore isnt replatforming paas
export type Lesson = { postId: string; title: string; summary: string };
export type LessonGroup = { id: string; title: string; lessons: readonly Lesson[] };

export const LESSON_GROUPS: readonly LessonGroup[] = [
  {
    id: 'architecture-and-migration',
    title: 'Architecture and migration',
    lessons: [
      {
        postId: '2025-04-16-decommissioning-a-telehealth-platform',
        title: 'Decommissioning starts with the records, not the servers',
        summary: 'Settle retention and retrieval requirements before switching anything off. A mechanical export into a simple, access-controlled archive is easier to operate and explain than a clever pipeline.',
      },
      {
        postId: '2025-03-12-carving-out-a-shared-service',
        title: 'Rehearse regional independence before cutting over',
        summary: 'When a region must stand alone, make the dependencies explicit. Copy the shared service, prune what does not belong and re-point consumers through a rehearsed runbook rather than redesigning the service during migration.',
      },
      {
        postId: '2026-09-02-data-residency-without-a-full-stack',
        title: 'Draw the data boundary beyond the database',
        summary: 'Place state deliberately, then check queues, workflows, analytics, logs and vendors for copies that cross the boundary. Shared compute is an option only where the processing requirements permit it.',
      },
    ],
  },
  {
    id: 'payments-and-commercial-rules',
    title: 'Payments and commercial rules',
    lessons: [
      {
        postId: '2025-01-22-payment-close-to-shipment',
        title: 'Take payment close to the moment you deliver value',
        summary: 'Separate the request from fulfilment and treat payment as one eligibility gate. Keeping payment state in your own model makes retries and new product types easier to handle without coupling every workflow to a provider.',
      },
      {
        postId: '2026-07-22-one-list-price-many-coupons',
        title: 'A price is a catalogue entry; a promotion is a policy',
        summary: 'Keep list prices few and stable. Express discounts as named adjustments with explicit conditions and stacking rules, so each marketing idea does not become a data migration.',
      },
      {
        postId: '2025-10-15-make-the-invoice-service-dumber',
        title: 'Keep the code closest to the money boring',
        summary: 'Let the payment-provider component handle payment concepts, not marketing rules. Compose line items in the layer above it so commercial behaviour can change without rewriting the payment core.',
      },
    ],
  },
  {
    id: 'reliability-and-data-integrity',
    title: 'Reliability and data integrity',
    lessons: [
      {
        postId: '2026-07-08-search-then-create-is-a-race',
        title: 'An existence check is not a uniqueness constraint',
        summary: 'A search index, cache or read replica cannot guarantee that another request has not already created the same thing. Define what makes an operation unique, then enforce it with a strongly consistent conditional write.',
      },
      {
        postId: '2026-02-11-load-testing-autoscaling-unsafe',
        title: 'Bound the load before adding more capacity',
        summary: 'Autoscaling does not supply admission control or stop retry loops. Bound concurrency and fan-out first, then scale on signals that reflect real pressure rather than adding more participants to an overloaded system.',
      },
      {
        postId: '2026-06-24-rotating-credentials-without-downtime',
        title: 'Test the incident question on a quiet day',
        summary: 'Make credential rotation routine, using an inventory and overlapping validity where possible. Then ask what a particular credential touched: if the audit trail cannot answer, improve it before an incident forces the question.',
      },
    ],
  },
  {
    id: 'ai-assisted-engineering',
    title: 'AI-assisted engineering',
    lessons: [
      {
        postId: '2026-10-05-adversarial-tests-before-code',
        title: 'Challenge the tests before implementing against them',
        summary: 'Review whether tests can be satisfied by an implementation that misses the intent. Make structural checks enforceable and resolve ambiguity while changing direction still costs a test edit rather than a production revert.',
      },
      {
        postId: '2026-10-05-the-author-is-compromised',
        title: 'Separate the writer from the reviewer',
        summary: 'Do not ask the authoring session to be the independent judge of its own work. Use a fresh, read-only review context and enforce architectural constraints in tooling rather than relying on the agent to remember them.',
      },
      {
        postId: '2026-08-19-substrate-was-the-problem',
        title: 'Measure a harness by the attention it costs',
        summary: 'More gates do not necessarily make a workflow better. Keep the contract in validated artefacts, give each phase a fresh context and reserve interruptions for decisions that genuinely need human judgement.',
      },
    ],
  },
  {
    id: 'delivery-and-technical-judgement',
    title: 'Delivery and technical judgement',
    lessons: [
      {
        postId: '2026-08-05-fix-dx-before-replatforming',
        title: 'Fix developer experience before changing the runtime',
        summary: 'An unreliable local loop or shared development environment is not solved by moving production elsewhere. Fix the seams between repositories and environments first, then make the runtime decision on operational evidence.',
      },
      {
        postId: '2026-09-16-cheaper-platform-isnt-cheaper-migration',
        title: 'Cost the migration, not just the destination',
        summary: 'Include engineering effort, hardening, dual running and the product work that will be delayed. A cheaper platform can be the right destination without making migration the right investment now.',
      },
      {
        postId: '2026-04-22-evaluating-a-paas-on-aws',
        title: 'Evaluate the hardest requirement, not the best demo',
        summary: 'Prove the security edge, delivery model and regional rollout before committing to a platform. Managed infrastructure can reduce the work without removing your responsibility for data, messaging and an exit path.',
      },
    ],
  },
];
