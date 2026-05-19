/**
 * Curated non-English financial RSS feeds.
 * Each feed targets a specific language/region and financial vertical.
 */
export interface FeedSource {
  url: string;
  language: string;
  name: string;
  region: string;
  vertical: string;
}

export const FEED_REGISTRY: FeedSource[] = [
  // Arabic — Central Bank & FX
  {
    url: 'https://www.alarabiya.net/feed/business',
    language: 'ar',
    name: 'Al Arabiya Business',
    region: 'MENA',
    vertical: 'central-bank',
  },
  {
    url: 'https://www.aljazeera.net/feed/economy',
    language: 'ar',
    name: 'Al Jazeera Economy',
    region: 'MENA',
    vertical: 'trade-policy',
  },

  // Portuguese — Brazil FX & Trade
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

  // Mandarin — China Policy & Trade
  {
    url: 'https://www.caixin.com/rss/caixin.xml',
    language: 'zh',
    name: 'Caixin',
    region: 'China',
    vertical: 'trade-policy',
  },

  // Korean — BOK & FX
  {
    url: 'https://www.mk.co.kr/rss/30100041/',
    language: 'ko',
    name: 'Maeil Business',
    region: 'Korea',
    vertical: 'central-bank',
  },

  // Turkish — CBRT & FX
  {
    url: 'https://www.bloomberght.com/rss',
    language: 'tr',
    name: 'Bloomberg HT',
    region: 'Turkey',
    vertical: 'fx-direction',
  },

  // Swahili — East Africa
  {
    url: 'https://www.bbc.com/swahili/topics/c2dwqdn2jz5t/rss.xml',
    language: 'sw',
    name: 'BBC Swahili Business',
    region: 'East Africa',
    vertical: 'trade-policy',
  },
];
