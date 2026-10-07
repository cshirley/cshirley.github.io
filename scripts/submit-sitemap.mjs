#!/usr/bin/env node
/**
 * Submit the sitemap to Google Search Console (Sitemaps API, webmasters v3).
 *
 *   node scripts/submit-sitemap.mjs [--dry-run]
 *
 * Env:
 *   GSC_SERVICE_ACCOUNT_JSON  service account key JSON (secret). Skips with a warning if unset.
 *   GSC_SITE                  Search Console property, exactly as listed there: either
 *                             "sc-domain:shirleyconsulting.co.uk" or "https://www.shirleyconsulting.co.uk/".
 *                             Default is the URL-prefix property.
 *
 * The service account's email must be added as a user (Full permission) on the property.
 * Uses only Node built-ins so CI can run it without `npm ci`.
 */
import { createSign } from 'node:crypto';
import { annotate } from './lib/dist.mjs';

const SITE = 'https://www.shirleyconsulting.co.uk/';
const SITEMAP = new URL('sitemap.xml', SITE).href;
const PROPERTY = process.env.GSC_SITE || SITE;
const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const dryRun = process.argv.includes('--dry-run');

const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!raw) {
  annotate('warning', 'Sitemap submit: GSC_SERVICE_ACCOUNT_JSON not set. Skipping.');
  process.exit(0);
}
console.log(`Submitting ${SITEMAP} to property ${PROPERTY}.`);
if (dryRun) process.exit(0);

const key = JSON.parse(raw);
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`token: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

try {
  const token = await accessToken();
  const url =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}` +
    `/sitemaps/${encodeURIComponent(SITEMAP)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  console.log(`Sitemap submit: accepted (HTTP ${res.status}).`);
} catch (err) {
  annotate('error', `Sitemap submit: ${err.message}`);
  process.exit(1);
}
