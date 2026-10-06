# Sharing posts on LinkedIn

Every deploy, including the daily cron rebuild that publishes scheduled posts, shares each newly
live post on Clive's **personal LinkedIn profile** as an article link post. The work is done by
`scripts/linkedin-post.mjs`, called from the "Share new posts on LinkedIn" step in
`.github/workflows/pages.yml`.

## How it works

1. Before deploying, CI saves the live sitemap (`scripts/indexnow.mjs --snapshot`).
2. After deploying, `linkedin-post.mjs --since <snapshot>` lists sitemap URLs that weren't there
   before and keeps only post URLs (`/<category>/yyyy/mm/dd/slug.html`).
3. For each one it reads `og:title` and `og:description` from the live page and calls the
   [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
   (`POST https://api.linkedin.com/rest/posts`) with the link as an `article`. LinkedIn scrapes
   the og tags for the thumbnail.
4. The step has `continue-on-error`, so a LinkedIn failure never blocks a deploy. It shows as an
   annotation on the run. If the secret or variable is missing, it skips with a warning.

LinkedIn has no public API for native long-form Articles, and the self-serve Posts API has no
scheduling field. Sharing right after the deploy avoids both problems, and the link never 404s.

## Configuration

| Name | Kind | Value |
|------|------|-------|
| `LINKEDIN_ACCESS_TOKEN` | Repository **secret** | OAuth access token (expires after about 60 days) |
| `LINKEDIN_AUTHOR` | Repository **variable** | `urn:li:person:<sub>`, where `<sub>` is your member id (below) |
| `LINKEDIN_VERSION` | Optional env var in the script | API version `YYYYMM`. Default is in the script. |

Set them under Settings → Secrets and variables → Actions (secrets tab and variables tab).

## One-off setup

### 1. Create the app

LinkedIn requires every app to belong to a Company Page.

1. Create a free page at <https://www.linkedin.com/company/setup/new> (a name, slug, industry and
   size are enough). The page is only there to satisfy this rule. Posts still go to the personal
   profile.
2. At <https://developers.linkedin.com/> create an app, select that page, and upload a logo.
3. On the app's **Settings** tab click **Verify**, open the URL while logged in as a page admin,
   and approve it.
4. On the **Products** tab request both (each is self-serve and normally approved instantly):
   - **Share on LinkedIn**, which grants `w_member_social` (needed to post).
   - **Sign In with LinkedIn using OpenID Connect**, which grants `openid` and `profile` (needed
     only to look up your member id).
5. On the **Auth** tab add the redirect URL `http://localhost:3000/callback`. Note the **Client
   ID** and **Client Secret**.

### 2. Get an access token and your member id

The portal's OAuth Token Tools can issue a token with all three scopes, but a token made there
may get a 403 from `GET /v2/userinfo`, and it doesn't show the `id_token`. The reliable route is
the authorisation code flow, which returns both an `access_token` and an `id_token`.

**a. Authorise.** Open this URL in a browser, logged in as Clive (replace `CLIENT_ID`):

```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=CLIENT_ID&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&scope=openid%20profile%20w_member_social
```

Approve the consent screen. The browser then fails to load `localhost:3000`. That's expected.
Copy the `code` query parameter from the address bar. It's single use and expires within minutes.

**b. Exchange the code:**

```bash
curl -s -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -d grant_type=authorization_code \
  -d code=CODE \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  --data-urlencode redirect_uri=http://localhost:3000/callback
```

The response contains:

- `access_token`: goes in the `LINKEDIN_ACCESS_TOKEN` secret.
- `expires_in`: seconds until expiry (about 60 days).
- `id_token`: a JWT that holds your member id.

**c. Read the member id.** The `sub` claim in the `id_token` is your member id. A JWT is three
base64url parts separated by dots. Decode the middle one:

```bash
echo '<middle part of the id_token>' | tr '_-' '/+' | base64 -d 2>/dev/null
```

If `base64` complains, add `=` padding until the length is a multiple of 4. The output looks like
`{"iss":"https://www.linkedin.com","sub":"AbC123xyz",...}`.

If `GET https://api.linkedin.com/v2/userinfo` works with the token (`Authorization: Bearer <token>`),
its `sub` field is the same value. A 403 there is common and doesn't matter.

**d. Set the variable** `LINKEDIN_AUTHOR` to `urn:li:person:` followed by the `sub`, for example
`urn:li:person:AbC123xyz`. Don't use the placeholder `<sub>`. A wrong author gives a 403 from the
Posts API.

### 3. Test without publishing

`lifecycleState: DRAFT` saves a draft instead of posting. Delete the draft in LinkedIn afterwards.

```bash
curl -s -i -X POST https://api.linkedin.com/rest/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Linkedin-Version: 202511" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" \
  -d '{"author":"urn:li:person:<sub>","commentary":"test","visibility":"PUBLIC","distribution":{"feedDistribution":"MAIN_FEED"},"lifecycleState":"DRAFT"}'
```

`201` means the token, author and API version are all good. The new post id is in the
`x-restli-id` header.

## Sharing by hand

```bash
npm run linkedin -- --dry-run <post-url>      # print what would be posted
LINKEDIN_ACCESS_TOKEN=… LINKEDIN_AUTHOR=urn:li:person:… npm run linkedin -- <post-url>   # posts for real
```

The post must be live, because the title and description are read from the live page.

### From GitHub

Run the **Share post on LinkedIn** workflow (`.github/workflows/linkedin.yml`) from the Actions
tab, or with the GitHub CLI:

```bash
gh workflow run linkedin.yml -f urls="<post-url>"               # post for real
gh workflow run linkedin.yml -f urls="<post-url>" -f dry_run=true   # print only
```

It uses the same secret and variable. Unlike the deploy step, a failure here fails the run, so
you see it straight away. It doesn't check whether the post was already shared, so running it
twice posts twice.

## Renewing the token

The token lasts about 60 days, and self-serve apps don't get refresh tokens. About every two
months, repeat step 2a and 2b and replace the `LINKEDIN_ACCESS_TOKEN` secret. The member id and
`LINKEDIN_AUTHOR` don't change. When the token has expired, the step fails with an `HTTP 401`
annotation and the deploy is unaffected.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| 403 `Not enough permissions` on `/rest/posts` | Token lacks `w_member_social`, "Share on LinkedIn" isn't added to the app, or `LINKEDIN_AUTHOR` doesn't match the token's member (including a literal `<sub>`) |
| 403 on `/v2/userinfo` | Token came from the portal tool, or the OpenID Connect product isn't added. Use the code flow |
| 401 | Token expired or revoked. Renew it |
| 426 or `version not active` | `LINKEDIN_VERSION` is retired. Set a current `YYYYMM` |
| Step logs "skipping" | Secret or variable not set, or no new posts in this deploy |
