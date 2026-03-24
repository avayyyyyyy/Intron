interface DomainSkill {
  domain: string;
  name: string;
  skill: string;
}

const DOMAIN_SKILLS: DomainSkill[] = [
  {
    domain: "google.com",
    name: "Google Search",
    skill: `- Navigate to google.com/search?q=ENCODED_QUERY directly — avoids autocomplete interference.
- Image: &tbm=isch. News: &tbm=nws. Time filter: &tbs=qdr:d (day), qdr:w (week), qdr:m (month).
- Pagination: &start=10 (page 2), &start=20 (page 3).
- Search input: textarea[name="q"] (Google migrated from input to textarea — try textarea first).
- Results: div#rso contains result blocks. Titles: div.g h3. Links: div.g a[href]. Snippets: div.VwiC3b.
- "People Also Ask": div.related-question-pair (click question text to expand).
- Google randomizes class names periodically — always use fallback selectors.
- EU cookie consent blocks interaction — dismiss with button#L2AGLb.
- CAPTCHA triggers after ~50-100 rapid requests. Add 3-5s delays between searches.`,
  },
  {
    domain: "mail.google.com",
    name: "Gmail",
    skill: `- Direct compose: mail.google.com/mail/?view=cm&fs=1&tf=1&to=EMAIL&su=SUBJECT&body=BODY
- Inbox: /mail/u/0/#inbox. Sent: #sent. Drafts: #drafts. Search: #search/QUERY. Labels: #label/NAME.
- Compose button: keyboard shortcut "c" is most reliable. Or div[gh="cm"].
- To field: input[aria-label="To"] (type address then Enter/Tab to confirm chip).
- Subject: input[aria-label="Subject"] or input[name="subjectbox"].
- Body: div[aria-label="Message Body"][contenteditable="true"] — NOT a textarea. Click to focus then type.
- Email rows: tr.zA. Click subject/snippet to open, not checkbox.
- Search bar: input[aria-label="Search mail"].
- Keyboard: c (compose), / (search), e (archive), # (delete), Ctrl+Enter (send).
- Draft auto-save is active — do NOT click Send without user confirmation.`,
  },
  {
    domain: "docs.google.com",
    name: "Google Docs",
    skill: `- CRITICAL: Google Docs uses CANVAS-BASED rendering. Document text is NOT in the DOM. querySelector will not find text content.
- To read content: use Ctrl+A then Ctrl+C (clipboard), or export URL: docs.google.com/document/d/DOC_ID/export?format=txt
- To edit: click to place cursor, then type. Keyboard shortcuts are the most reliable interaction method.
- Alt+/ opens "search menus" — type any command name to find and execute it (most powerful shortcut).
- Toolbar buttons use aria-label — target them via [aria-label="Bold"], [aria-label="Italic"], etc.
- Menu bar items are div elements, not native menus — click "File", "Edit", etc.
- getScreenshot is more reliable than text extraction for understanding layout.
- Comments: Ctrl+Alt+M after selecting text.`,
  },
  {
    domain: "calendar.google.com",
    name: "Google Calendar",
    skill: `- Direct event creation URL: calendar.google.com/calendar/r/eventedit?text=TITLE&dates=YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS&details=DETAILS&location=LOCATION
- Click a time slot to open quick-add popover, or use "+ Create" / keyboard "c" for full form.
- Date nav: forward/back arrows or "Today" button. Press "t" for today.
- View switching: "d" (day), "w" (week), "m" (month). Or click toolbar buttons.
- Event form fields use aria-label for selectors.
- Recurring events: "Does not repeat" dropdown in event form.
- Natural language: pressing 'c' and typing "Meeting at 3pm tomorrow" works for quick creation.`,
  },
  {
    domain: "github.com",
    name: "GitHub",
    skill: `- URL patterns: /OWNER/REPO (repo), /blob/BRANCH/path (file), /tree/BRANCH/path (dir), /blame/BRANCH/path (blame).
- Raw file: raw.githubusercontent.com/OWNER/REPO/BRANCH/path (no UI, just content).
- Compare: /compare/BASE...HEAD. Line link: append #L10 or #L10-L20 to blob URL.
- Code search: github.com/search?q=QUERY+repo:OWNER/REPO&type=code. Qualifiers: language:js, path:src/, org:NAME.
- New issue prefill: /issues/new?title=TITLE&body=BODY&labels=bug. New PR: /compare/BASE...HEAD?expand=1.
- GitHub uses Turbo navigation — page transitions don't trigger full reloads. Wait for content to settle after clicking links.
- Markdown editor uses plain <textarea> (NOT contenteditable). Issue body: id="issue_body". PR body: name="pull_request[body]".
- PR diff: each file in .file with data-path. Additions: .blob-code-addition. Deletions: .blob-code-deletion.
- Keyboard: / (search), t (file finder), g c (code), g i (issues), g p (PRs), Cmd+K (command palette), y (permalink).
- Auth check: meta[name="user-login"] has username when logged in. "Sign in" link = not authenticated.`,
  },
  {
    domain: "x.com",
    name: "Twitter/X",
    skill: `- ALWAYS use data-testid selectors — CSS class names are obfuscated and change every deploy.
- Tweet: article[data-testid="tweet"]. Text: [data-testid="tweetText"]. Photo: [data-testid="tweetPhoto"].
- Like: [data-testid="like"]/[data-testid="unlike"]. Retweet: [data-testid="retweet"]/[data-testid="unretweet"]. Reply: [data-testid="reply"]. Bookmark: [data-testid="bookmark"].
- Compose: [data-testid="tweetTextarea_0"] (contenteditable). Submit: [data-testid="tweetButton"]. Sidebar post: [data-testid="SideNav_NewTweet_Button"].
- Compose URL: x.com/compose/tweet?text=ENCODED_TEXT.
- Profile: x.com/USERNAME. Tweet: x.com/USERNAME/status/ID. Search: x.com/search?q=QUERY&src=typed_query. Latest: &f=live. People: &f=user.
- Search operators: from:user, to:user, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, filter:links/images/videos.
- DOM virtualization: only ~20-30 tweets in DOM at once. Extract data as you scroll — old tweets are unmounted.
- Scroll target: window/document (not an inner container). IntersectionObserver triggers loading.
- Login required — unauthenticated redirects to /i/flow/login.
- Anti-bot is severe: ML behavioral analysis, device fingerprinting. Add human-like delays between actions.`,
  },
  {
    domain: "linkedin.com",
    name: "LinkedIn",
    skill: `- Uses Artdeco design system class names (artdeco-*, scaffold-*, pv-*, feed-shared-*) — NOT data-testid.
- Ember.js generates sequential ember{N} IDs — NOT stable across page loads. Use class-based selectors.
- Search: linkedin.com/search/results/all/?keywords=QUERY. People: /people/. Companies: /companies/. Content: /content/.
- Jobs: linkedin.com/jobs/search/?keywords=QUERY&location=LOC. Filters: f_TPR (time), f_E (experience), f_JT (job type).
- Profile: linkedin.com/in/USERNAME. Messaging: /messaging/. Notifications: /notifications/.
- Post composer: click "Start a post" → modal with contenteditable area.
- Structured data in <script type="application/ld+json"> — most reliable for public page extraction.
- Pagination via .artdeco-pagination on search/jobs (not infinite scroll for these).
- LinkedIn shows frequent modals (sign-in, premium upsells) — dismiss before proceeding.
- Anti-bot: behavioral biometrics. Safe limits: ~20 connection requests/day, ~80-100 profile views/day.
- Heavy JS rendering — always wait for page load after navigation.`,
  },
  {
    domain: "amazon.com",
    name: "Amazon",
    skill: `- Search: amazon.com/s?k=ENCODED_QUERY&page=N. Sort: &s=price-asc-rank, price-desc-rank, review-rank.
- Product: amazon.com/dp/ASIN (canonical — slug text before it is ignored).
- Reviews: amazon.com/product-reviews/ASIN.
- Search results: div[data-component-type="s-search-result"] with data-asin and data-index attributes.
- Title: h2 a span. Price: .a-price .a-offscreen (clean text like "$29.99"). Rating: i.a-icon-star-small span.a-icon-alt.
- Product page: #productTitle, span.priceToPay, #acrPopover (rating), #feature-bullets ul li, #add-to-cart-button.
- Amazon uses PAGINATION, not infinite scroll. Next: .s-pagination-next or &page=N in URL.
- No Shadow DOM — standard querySelector works everywhere.
- Anti-bot: AWS WAF. CAPTCHA page titled "Robot Check". Add 1-5s random delays. Residential proxies for scale.
- JSON-LD structured data sometimes in <script> tags for product info.
- NEVER complete purchases — stop at checkout and hand control to the user.`,
  },
  {
    domain: "youtube.com",
    name: "YouTube",
    skill: `- Search: youtube.com/results?search_query=ENCODED_QUERY.
- Watch: youtube.com/watch?v=VIDEO_ID. Timestamp: &t=120s. Channel: youtube.com/@HANDLE.
- Playlist: youtube.com/playlist?list=ID. Shorts: youtube.com/shorts/VIDEO_ID.
- Built on ytd-* custom web components (light DOM, not closed Shadow DOM).
- Search results: ytd-video-renderer. Title: a#video-title (text + href). Metadata: #metadata-line > span (views, age).
- Video length: ytd-thumbnail-overlay-time-status-renderer span#text.
- Watch page: video player #movie_player. Title: h1 yt-formatted-string. Channel: ytd-channel-name a.
- Transcript: click "...more" below description → "Show transcript" button. Or use ytInitialData JS object.
- ytInitialData embedded in page source contains everything as JSON — best for structured extraction.
- Infinite scroll everywhere. Continuation via ytd-continuation-item-renderer loading spinner.
- Video player keyboard: K (play/pause), J (-10s), L (+10s), M (mute), F (fullscreen), C (captions).
- Comments lazy-load — must scroll past the video to trigger loading.
- EU consent page "Before you continue" blocks access until cookies accepted.`,
  },
  {
    domain: "reddit.com",
    name: "Reddit",
    skill: `- Search: reddit.com/search/?q=QUERY. Subreddit search: reddit.com/r/SUBREDDIT/search/?q=QUERY.
- Subreddit: reddit.com/r/NAME. Post: reddit.com/r/NAME/comments/POST_ID/slug.
- New design uses shreddit-post web components. Post data stored as HTML ATTRIBUTES: post-title, author, score, comment-count, permalink, created-timestamp — no Shadow DOM piercing needed for metadata.
- Comment bodies require Shadow DOM: element.shadowRoot.querySelector('div[slot="comment"]').
- BEST APPROACH: Use old.reddit.com + .json suffix for structured JSON without JS rendering.
- Example: old.reddit.com/r/programming/top.json?limit=25&t=week
- JSON API supports after parameter for pagination.
- Infinite scroll on feeds in new Reddit. Comments are nested/threaded.
- Comment composer has rich text (contenteditable) or markdown mode toggle.
- reCAPTCHA v3 on every page. ~100 requests/minute rate limit on API.
- Old.reddit.com has much simpler DOM — prefer it for scraping tasks.`,
  },
];

const DOMAIN_ALIASES: Record<string, string> = {
  "twitter.com": "x.com",
  "www.twitter.com": "x.com",
};

export function getSkillsForUrl(url: string): DomainSkill[] {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return [];
  }

  if (DOMAIN_ALIASES[hostname]) {
    hostname = DOMAIN_ALIASES[hostname];
  }

  const bare = hostname.replace(/^www\./, "");

  // Exact hostname match first (e.g., mail.google.com before google.com)
  const exact = DOMAIN_SKILLS.filter(
    (s) => s.domain === hostname || s.domain === bare,
  );
  if (exact.length > 0) return exact;

  // Base domain fallback (e.g., sheets.google.com → google.com)
  const parts = bare.split(".");
  if (parts.length > 2) {
    const base = parts.slice(-2).join(".");
    return DOMAIN_SKILLS.filter((s) => s.domain === base);
  }

  return [];
}
