// RSS 2.0 feed for field notes — full content, newest first.
import type { APIRoute } from 'astro';
import { noteFeedItems, rssFeed } from '../../data/feeds';

export const GET: APIRoute = async () => {
  const xml = rssFeed({
    collectionTitle: 'Field Notes',
    collectionPath: '/field-notes/',
    items: await noteFeedItems(),
  });
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
