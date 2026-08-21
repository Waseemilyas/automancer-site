/**
 * Feed generators shared by /work and /field-notes.
 * RSS 2.0 (full content in CDATA) and JSON Feed 1.1.
 */
import { business } from './business';

export interface FeedItem {
  slug: string;
  path: string;
  title: string;
  description: string;
  date: Date;
  /** Full content — raw Markdown. */
  body: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rssFeed(opts: {
  collectionTitle: string;
  collectionPath: string;
  items: FeedItem[];
}): string {
  const feedUrl = new URL(`${opts.collectionPath}rss.xml`, business.url).toString();
  const channel = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${esc(`${business.tradingName} — ${opts.collectionTitle}`)}</title>`,
    `<link>${esc(new URL(opts.collectionPath, business.url).toString())}</link>`,
    `<description>${esc(business.description)}</description>`,
    '<language>en-gb</language>',
    `<atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />`,
  ];
  for (const item of opts.items) {
    channel.push(
      '<item>',
      `<title>${esc(item.title)}</title>`,
      `<link>${esc(new URL(item.path, business.url).toString())}</link>`,
      `<guid>${esc(new URL(item.path, business.url).toString())}</guid>`,
      `<pubDate>${item.date.toUTCString()}</pubDate>`,
      `<description>${esc(item.description)}</description>`,
      `<content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[${item.body}]]></content:encoded>`,
      '</item>'
    );
  }
  channel.push('</channel>', '</rss>');
  return channel.join('\n');
}

export function jsonFeed(opts: {
  collectionTitle: string;
  collectionPath: string;
  items: FeedItem[];
}): object {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${business.tradingName} — ${opts.collectionTitle}`,
    home_page_url: business.url,
    feed_url: new URL(`${opts.collectionPath}feed.json`, business.url).toString(),
    description: business.description,
    language: 'en-GB',
    authors: [{ name: 'Waseem Ilyas', url: new URL('/about', business.url).toString() }],
    items: opts.items.map((item) => ({
      id: new URL(item.path, business.url).toString(),
      url: new URL(item.path, business.url).toString(),
      title: item.title,
      summary: item.description,
      // Raw Markdown is plain-text-safe; full content, not an excerpt.
      content_text: item.body,
      date_published: item.date.toISOString(),
    })),
  };
}
