/**
 * Curated financial RSS feeds — global coverage for FX, central banks, trade policy.
 * Feeds verified accessible; DNS-blocked or paywalled sources replaced with alternatives.
 */
export interface FeedSource {
  url: string;
  language: string;
  name: string;
  region: string;
  vertical: string;
}

export const FEED_REGISTRY: FeedSource[] = [
  // ── French (ECB / EUR) ───────────────────────────────────────────────────
  {
    url: 'https://www.lemonde.fr/economie/rss_full.xml',
    language: 'fr',
    name: 'Le Monde Économie',
    region: 'France',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.latribune.fr/rss/economie.html',
    language: 'fr',
    name: 'La Tribune Économie',
    region: 'France',
    vertical: 'fx-direction',
  },

  // ── German (Bundesbank / ECB) ────────────────────────────────────────────
  {
    url: 'https://newsfeed.zeit.de/wirtschaft/index',
    language: 'de',
    name: 'Zeit Online Wirtschaft',
    region: 'Germany',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.spiegel.de/wirtschaft/index.rss',
    language: 'de',
    name: 'Spiegel Wirtschaft',
    region: 'Germany',
    vertical: 'trade-policy',
  },

  // ── Spanish (LatAm / Spain) ──────────────────────────────────────────────
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    language: 'es',
    name: 'El País Economía',
    region: 'Spain',
    vertical: 'trade-policy',
  },
  {
    url: 'https://www.expansion.com/rss/mercados.xml',
    language: 'es',
    name: 'Expansión Mercados',
    region: 'Spain',
    vertical: 'fx-direction',
  },

  // ── Portuguese — Brazil (BCB / BRL) ─────────────────────────────────────
  {
    url: 'https://feeds.folha.uol.com.br/mercado/rss091.xml',
    language: 'pt',
    name: 'Folha Mercado',
    region: 'Brazil',
    vertical: 'fx-direction',
  },
  {
    url: 'https://www.infomoney.com.br/feed/',
    language: 'pt',
    name: 'InfoMoney',
    region: 'Brazil',
    vertical: 'central-bank',
  },

  // ── Korean (BOK / KRW) ──────────────────────────────────────────────────
  {
    url: 'https://www.mk.co.kr/rss/30100041/',
    language: 'ko',
    name: 'Maeil Business',
    region: 'Korea',
    vertical: 'central-bank',
  },

  // ── Japanese (BOJ / JPY) — via Reuters Japan (English) ──────────────────
  {
    url: 'https://feeds.reuters.com/reuters/JPBusinessNews',
    language: 'ja',
    name: 'Reuters Japan Business',
    region: 'Japan',
    vertical: 'central-bank',
  },

  // ── Arabic (MENA) — via Al-Monitor Economy ───────────────────────────────
  {
    url: 'https://www.al-monitor.com/rss/economy',
    language: 'ar',
    name: 'Al-Monitor Economy',
    region: 'MENA',
    vertical: 'trade-policy',
  },

  // ── Turkish (CBRT / TRY) — via Anadolu Agency ───────────────────────────
  {
    url: 'https://www.aa.com.tr/en/rss/rss.php?cat=economy',
    language: 'tr',
    name: 'Anadolu Agency Economy',
    region: 'Turkey',
    vertical: 'central-bank',
  },

  // ── Nigeria (CBN / NGN / oil) ─────────────────────────────────────────────
  {
    url: 'https://businessday.ng/feed/',
    language: 'en',
    name: 'BusinessDay Nigeria',
    region: 'Nigeria',
    vertical: 'central-bank',
  },
  {
    url: 'https://nairametrics.com/feed/',
    language: 'en',
    name: 'Nairametrics',
    region: 'Nigeria',
    vertical: 'fx-direction',
  },
  {
    url: 'https://www.vanguardngr.com/category/business/feed/',
    language: 'en',
    name: 'Vanguard Business',
    region: 'Nigeria',
    vertical: 'trade-policy',
  },

  // ── China (PBOC / CNY) — via South China Morning Post ───────────────────
  {
    url: 'https://www.scmp.com/rss/5/feed',
    language: 'zh',
    name: 'SCMP Business',
    region: 'China',
    vertical: 'trade-policy',
  },
  {
    url: 'https://feeds.reuters.com/reuters/CNBusinessNews',
    language: 'zh',
    name: 'Reuters China Business',
    region: 'China',
    vertical: 'central-bank',
  },

  // ── Indonesia (BI / IDR) ─────────────────────────────────────────────────
  {
    url: 'https://www.cnbcindonesia.com/rss',
    language: 'id',
    name: 'CNBC Indonesia',
    region: 'Indonesia',
    vertical: 'central-bank',
  },

  // ── Vietnam (SBV / VND) ──────────────────────────────────────────────────
  {
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    language: 'vi',
    name: 'VnExpress Kinh Doanh',
    region: 'Vietnam',
    vertical: 'trade-policy',
  },

  // ── Southeast Asia (CNA — English) ───────────────────────────────────────
  {
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511',
    language: 'en',
    name: 'CNA Business',
    region: 'Southeast Asia',
    vertical: 'trade-policy',
  },

  // ── Philippines (BSP / PHP) ──────────────────────────────────────────────
  {
    url: 'https://www.philstar.com/rss/business',
    language: 'en',
    name: 'Philippine Star Business',
    region: 'Philippines',
    vertical: 'central-bank',
  },

  // ── Malaysia (BNM / MYR) — Bernama national news agency ─────────────────
  {
    url: 'https://www.bernama.com/services/bernama_rss.php?cat=biz',
    language: 'en',
    name: 'Bernama Business',
    region: 'Malaysia',
    vertical: 'central-bank',
  },

  // ── East Africa (via DW English) ─────────────────────────────────────────
  {
    url: 'https://rss.dw.com/rdf/rss-en-bus',
    language: 'en',
    name: 'DW Business (Africa)',
    region: 'East Africa',
    vertical: 'trade-policy',
  },
];
