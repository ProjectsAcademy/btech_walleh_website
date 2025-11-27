// Netlify Edge Function to block known scrapers and bots
// This runs on every request and blocks known scraping tools

// List of known scraper user agents
const BLOCKED_USER_AGENTS = [
  // Website copiers
  "httrack",
  "htdig",
  "wget",
  "curl",
  "libwww-perl",
  "lwp-trivial",
  "python-requests",
  "python-urllib",
  "scrapy",
  "mechanize",
  "grab",
  "go-http-client",
  "java/",
  "okhttp",
  "apache-httpclient",
  "commons-httpclient",
  "httpunit",
  "nutch",
  "googledocs",
  "ia_archiver",
  "archive.org_bot",
  "msnbot",
  "yandex",
  "baiduspider",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "blexbot",
  "sogou",
  "exabot",
  "facebot",
  "ia_archiver",
  "siteauditbot",
  "sitebulb",
  "screaming frog",
  "sitebulb",
  "linkdexbot",
  "megaindex",
  "rogerbot",
  "dotbot",
  "sistrix",
  "lighthouse",
  "pagespeed",
  "gtmetrix",
  "pingdom",
  "uptimerobot",
  "monitor",
  "crawler",
  "spider",
  "bot",
  "scraper",
  "downloader",
  "extractor",
  "harvest",
  "collector",
  "grabber",
  "ripper",
  "copier",
  "mirror",
  "backup",
  "archive",
  "offline",
  "download",
  "wget",
  "curl",
  "python",
  "java",
  "perl",
  "ruby",
  "php",
  "node",
  "go",
  "rust",
  "c#",
  "vb.net",
  "powershell",
];

// Suspicious patterns in user agent
const SUSPICIOUS_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /downloader/i,
  /extractor/i,
  /harvest/i,
  /collector/i,
  /grabber/i,
  /ripper/i,
  /copier/i,
  /mirror/i,
  /backup/i,
  /archive/i,
  /offline/i,
  /download/i,
  /automated/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
  /chromium/i,
  /chrome-lighthouse/i,
];

// Check if user agent is a known scraper
function isScraper(userAgent: string): boolean {
  if (!userAgent) {
    return true; // Block requests without user agent
  }

  const ua = userAgent.toLowerCase();

  // Check against blocked list
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (ua.includes(blocked.toLowerCase())) {
      return true;
    }
  }

  // Check against suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(ua)) {
      return true;
    }
  }

  return false;
}

// Check for suspicious headers
function hasSuspiciousHeaders(headers: Headers): boolean {
  // Missing common browser headers
  const accept = headers.get("accept");
  const acceptLanguage = headers.get("accept-language");
  const acceptEncoding = headers.get("accept-encoding");

  // Bots often miss these headers
  if (!accept || !acceptLanguage) {
    return true;
  }

  // Check for suspicious referer patterns
  const referer = headers.get("referer");
  if (
    referer &&
    (referer.includes("localhost") ||
      referer.includes("127.0.0.1") ||
      referer.includes("file://"))
  ) {
    return true;
  }

  return false;
}

// Main edge function handler
export default async (request: Request) => {
  const userAgent = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  // Allow legitimate search engines (optional - remove if you want to block all)
  const allowedBots = [
    "googlebot",
    "bingbot",
    "slurp", // Yahoo
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "sogou",
    "exabot",
    "facebot",
    "ia_archiver",
  ];

  const isAllowedBot = allowedBots.some((bot) =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );

  // Block if it's a scraper and not an allowed bot
  if (
    !isAllowedBot &&
    (isScraper(userAgent) || hasSuspiciousHeaders(request.headers))
  ) {
    // Return 403 Forbidden
    return new Response("Access Denied", {
      status: 403,
      statusText: "Forbidden",
      headers: {
        "Content-Type": "text/plain",
        "X-Blocked-Reason": "Scraper/Bot detected",
      },
    });
  }

  // Allow the request to proceed
  return;
};
