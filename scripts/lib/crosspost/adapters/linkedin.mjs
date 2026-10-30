// LinkedIn: one feed post linking to the live article. Copy comes from the live page's og: tags.
import { PublishError } from '../runner.mjs';

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, prop) => {
  const m =
    html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i'));
  return m ? decode(m[1]) : '';
};

export const linkedin = {
  name: 'linkedin',
  /** One automatic creation per UTC day; any unresolved attempt blocks further automatic shares. */
  policy: { perRunLimit: 1, dailyAllowance: 1, blockOnReview: true },
  missingConfig: (env) => ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR'].filter((k) => !env[k]),

  async prepare(article, ctx) {
    const title = meta(ctx.liveHtml, 'og:title') || article.title;
    const description = meta(ctx.liveHtml, 'og:description') || article.description;
    return { title, description, commentary: description ? `${title}\n\n${description}` : title, source: article.url };
  },

  async publish(prepared, ctx) {
    const { env, fetch } = ctx;
    let res;
    try {
      res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
          'content-type': 'application/json',
          'Linkedin-Version': env.LINKEDIN_VERSION || '202511',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: env.LINKEDIN_AUTHOR,
          commentary: prepared.commentary,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
          content: { article: { source: prepared.source, title: prepared.title, description: prepared.description } },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new PublishError('uncertain', `LinkedIn request failed after submission: ${err.message}`);
    }
    if (res.status === 201) {
      const urn = res.headers.get('x-restli-id');
      if (!urn) throw new PublishError('uncertain', 'LinkedIn returned 201 without a share id');
      return { outcome: 'published', externalId: urn, url: `https://www.linkedin.com/feed/update/${urn}/` };
    }
    const detail = (await res.text().catch(() => '')).trim().slice(0, 300);
    // A definite client-side rejection (not a timeout) means nothing was created.
    if (res.status >= 400 && res.status < 500 && res.status !== 408) throw new PublishError('not-created', `LinkedIn rejected the post: HTTP ${res.status} ${detail}`);
    throw new PublishError('uncertain', `LinkedIn responded HTTP ${res.status} ${detail}`);
  },
};
