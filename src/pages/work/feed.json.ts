// JSON Feed 1.1 for case studies — full content, index order.
import type { APIRoute } from 'astro';
import { studyFeedItems, jsonFeed } from '../../data/feeds';

export const GET: APIRoute = async () => {
  const feed = jsonFeed({
    collectionTitle: 'Work — case studies',
    collectionPath: '/work/',
    items: await studyFeedItems(),
  });
  return new Response(JSON.stringify(feed, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
