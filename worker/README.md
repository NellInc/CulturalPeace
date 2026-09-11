# Amendment intake Worker

Replaces the per-principle Google Docs comment links. Each "Propose an
amendment" button on culturalpeace.org opens an in-page form; this Worker
validates the submission and opens a GitHub Issue in `NellInc/CulturalPeace`
labelled `amendment` and `principle-NN`. Submitters need no account.

## Anti-vandal measures

| Layer | What it stops |
|---|---|
| CORS allow-list | Posts from other sites or scripts without an allowed Origin |
| Turnstile, server-verified with hostname and action checks | Bots, scripted floods, tokens solved on other sites |
| Honeypot field | Naive form-fillers |
| Size and length caps | Payload abuse, 16 KB max |
| Native rate limiter, 3 per minute per IP | Bursts, evaluated before Turnstile (atomic) |
| KV hourly cap, 5 per IP, and 24 h duplicate rejection | Repeat spam, re-posting the same text |
| Fenced code blocks for all user text | Links, Markdown, HTML and @-mentions never render in the issue |

The KV namespace and the rate limiter binding are both required; the Worker answers 503 without them. Emails are
never written into the public issue. They are stored privately for 90 days
under `contact:<issue-number>`.

## One-time setup

1. **GitHub token.** Create a fine-grained personal access token scoped to
   the `CulturalPeace` repo with *Issues: read and write*. Consider making it
   from a dedicated bot account so issues are not attributed to you.
2. **Turnstile.** Cloudflare dashboard → Turnstile → Add site. Hostname
   `culturalpeace.org` (add `localhost` for testing). Note the site key
   (public) and secret key.
3. **Deploy.**

   ```bash
   cd worker
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler kv namespace create AMEND_KV   # paste the id into wrangler.toml
   npx wrangler deploy
   ```

   Note the Worker URL it prints.
4. **Wire the site.** In `docs/assets/site.js`, set `AMEND_ENDPOINT` to the
   Worker URL and `TURNSTILE_SITE_KEY` to the Turnstile site key. Until both
   are set, the form opens but tells the reader it is not yet connected.
5. **Labels.** Create them once so issue creation never depends on the
   token being allowed to add labels:

   ```bash
   gh label create amendment -R NellInc/CulturalPeace -c 26766f -d "Proposed change to a principle"
   for n in $(seq -w 1 14); do gh label create principle-$n -R NellInc/CulturalPeace -c f3efe7; done
   ```

## Reviewing proposals

Every proposal is a GitHub Issue. Discuss in the thread, then either edit the
principle in `docs/index.html` and close the issue with a reference to the
commit, or close it with a short reason. Filter by label to see everything
pending for one principle.

## Local test

```bash
cd worker && npx wrangler dev --env dev   # dev env allows localhost origins
```

Then serve the site (`cd docs && python -m http.server 8000`) and point
`AMEND_ENDPOINT` at `http://localhost:8787`. Turnstile's test site key
`1x00000000000000000000AA` always passes, paired with the test secret
`1x0000000000000000000000000000000AA`.
