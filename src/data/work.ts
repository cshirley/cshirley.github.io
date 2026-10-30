// Public summaries only. Internal costs, findings and provisional research stay out.
export type SelectedWork = {
  title: string;
  status: string;
  problem: string;
  contribution: string;
  outcome: string;
  postId?: string;
};

export const SELECTED_WORK: SelectedWork[] = [
  {
    title: 'Payments as a platform, not a one-off integration',
    status: 'Delivered',
    problem: 'Provider-coupled payment code and separate price configurations made each checkout change harder to reason about.',
    contribution: 'I designed and built a shared pricing API, multi-account payment adapters and the first partner configuration portal, rather than adding another bespoke checkout path.',
    outcome: 'The pricing API and portal are in production. I handed portal development to another engineer so the platform could grow beyond its first release.',
    postId: '2026-07-22-one-list-price-many-coupons',
  },
  {
    title: 'Fix developer experience before re-platforming',
    status: 'Delivered',
    problem: 'Running one service locally still depended on shared environments. A new runtime alone would not give engineers an isolated development loop.',
    contribution: 'I compared the options and built Medley: a one-command local stack with explicit dependencies and readiness checks, reusing Tilt rather than building a process supervisor.',
    outcome: 'Medley became part of engineering onboarding and moved into the backend monorepo. The runtime decision remained separate from the local-development fix.',
    postId: '2026-10-01-medley-one-command-local-stack',
  },
  {
    title: 'Identity: the right outcome was not to migrate',
    status: 'Decision made',
    problem: 'A lower licence bill made replacing the identity provider look attractive, before migration effort and ongoing ownership were counted.',
    contribution: 'I wrote the build-vs-buy analysis, including operating cost, engineering effort and migration risk, to make the decision explicit.',
    outcome: 'The business retained the incumbent after commercial renegotiation. My contribution was the analysis; commercial owners made the decision and negotiated the agreement.',
  },
];
