/**
 * Curated non-English financial RSS feeds.
 * Focused on FX rates, central bank policy, and trade — the verticals
 * Meridian prediction markets resolve against.
 */
export interface FeedSource {
  url: string;
  language: string;
  name: string;
  region: string;
  vertical: string;
}

export const FEED_REGISTRY: FeedSource[] = [
  // ── French (Eurozone / ECB policy) ──────────────────────────────────────
  {
    url: 'https://www.lemonde.fr/economie/rss_full.xml',
    language: 'fr',
    name: 'Le Monde Économie',
    region: 'France',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.lesechos.fr/rss/rss_finance.xml',
    language: 'fr',
    name: 'Les Echos Finance',
    region: 'France',
    vertical: 'fx-direction',
  },
  {
    url: 'https://bfmbusiness.bfmtv.com/rss/articles.xml',
    language: 'fr',
    name: 'BFM Business',
    region: 'France',
    vertical: 'trade-policy',
  },

  // ── German (Bundesbank / ECB) ────────────────────────────────────────────
  {
    url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen',
    language: 'de',
    name: 'Handelsblatt',
    region: 'Germany',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.faz.net/rss/aktuell/wirtschaft/',
    language: 'de',
    name: 'FAZ Wirtschaft',
    region: 'Germany',
    vertical: 'trade-policy',
  },

  // ── Portuguese (Brazil — BCB / BRL) ─────────────────────────────────────
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
  {
    url: 'https://valor.globo.com/rss/financas/index.xml',
    language: 'pt',
    name: 'Valor Econômico',
    region: 'Brazil',
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

  // ── Korean (BOK / KRW) ──────────────────────────────────────────────────
  {
    url: 'https://www.mk.co.kr/rss/30100041/',
    language: 'ko',
    name: 'Maeil Business',
    region: 'Korea',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.yna.co.kr/economy/all/rss.xml',
    language: 'ko',
    name: 'Yonhap Economy',
    region: 'Korea',
    vertical: 'trade-policy',
  },

  // ── Japanese (BOJ / JPY) ─────────────────────────────────────────────────
  {
    url: 'https://www3.nhk.or.jp/rss/news/cat4.xml',
    language: 'ja',
    name: 'NHK Economy',
    region: 'Japan',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.nikkei.com/rss/index.rdf',
    language: 'ja',
    name: 'Nikkei',
    region: 'Japan',
    vertical: 'fx-direction',
  },

  // ── Arabic (MENA / Gulf FX) ──────────────────────────────────────────────
  {
    url: 'https://www.skynewsarabia.com/rss/economy.xml',
    language: 'ar',
    name: 'Sky News Arabia Economy',
    region: 'MENA',
    vertical: 'fx-direction',
  },
  {
    url: 'https://www.alarabiya.net/arastudio/2023/5/22/rss.xml',
    language: 'ar',
    name: 'Al Arabiya Economy',
    region: 'MENA',
    vertical: 'trade-policy',
  },

  // ── Turkish (CBRT / TRY) ─────────────────────────────────────────────────
  {
    url: 'https://www.hurriyet.com.tr/rss/ekonomi',
    language: 'tr',
    name: 'Hürriyet Ekonomi',
    region: 'Turkey',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.sabah.com.tr/rss?c=ekonomi',
    language: 'tr',
    name: 'Sabah Ekonomi',
    region: 'Turkey',
    vertical: 'fx-direction',
  },

  // ── Swahili (East Africa) ────────────────────────────────────────────────
  {
    url: 'https://rss.dw.com/rdf/rss-sw-eco',
    language: 'sw',
    name: 'DW Swahili Economy',
    region: 'East Africa',
    vertical: 'trade-policy',
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

  // ── China (PBOC / CNY / trade) ───────────────────────────────────────────
  {
    url: 'https://www.21jingji.com/rss.xml',
    language: 'zh',
    name: '21st Century Business Herald',
    region: 'China',
    vertical: 'trade-policy',
  },
  {
    url: 'https://www.yicai.com/rss.html',
    language: 'zh',
    name: 'Yicai (第一财经)',
    region: 'China',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.cls.cn/api/sw?app=cls&terminal=pc&rss=1',
    language: 'zh',
    name: '财联社 CLS',
    region: 'China',
    vertical: 'fx-direction',
  },

  // ── Indonesia (BI / IDR) ─────────────────────────────────────────────────
  {
    url: 'https://www.cnbcindonesia.com/rss',
    language: 'id',
    name: 'CNBC Indonesia',
    region: 'Indonesia',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.kontan.co.id/rss/news',
    language: 'id',
    name: 'Kontan',
    region: 'Indonesia',
    vertical: 'fx-direction',
  },

  // ── Vietnam (SBV / VND) ──────────────────────────────────────────────────
  {
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    language: 'vi',
    name: 'VnExpress Kinh Doanh',
    region: 'Vietnam',
    vertical: 'trade-policy',
  },
  {
    url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
    language: 'vi',
    name: 'CafeF Markets',
    region: 'Vietnam',
    vertical: 'fx-direction',
  },

  // ── Malaysia (BNM / MYR) ─────────────────────────────────────────────────
  {
    url: 'https://www.theedgemarkets.com/rss',
    language: 'en',
    name: 'The Edge Markets',
    region: 'Malaysia',
    vertical: 'central-bank',
  },

  // ── Thailand (BOT / THB) ─────────────────────────────────────────────────
  {
    url: 'https://www.bangkokpost.com/rss/data/business.xml',
    language: 'en',
    name: 'Bangkok Post Business',
    region: 'Thailand',
    vertical: 'trade-policy',
  },

  // ── Philippines (BSP / PHP) ──────────────────────────────────────────────
  {
    url: 'https://business.inquirer.net/feed',
    language: 'en',
    name: 'Inquirer Business',
    region: 'Philippines',
    vertical: 'central-bank',
  },
];
