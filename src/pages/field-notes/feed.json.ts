// JSON Feed 1.1 for field notes — full content, newest first.
import type { APIRoute } from 'astro';
import { noteFeedItems, jsonFeed } from '../../data/feeds';

export const GET: APIRoute = async () => {
  const feed = jsonFeed({
    collectionTitle: 'Field Notes',
    collectionPath: '/field-notes/',
    items: await noteFeedItems(),
  });
  return new Response(JSON.stringify(feed, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
