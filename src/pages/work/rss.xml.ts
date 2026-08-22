// RSS 2.0 feed for case studies — full content, index order.
import type { APIRoute } from 'astro';
import { studyFeedItems, rssFeed } from '../../data/feeds';

export const GET: APIRoute = async () => {
  const xml = rssFeed({
    collectionTitle: 'Work — case studies',
    collectionPath: '/work/',
    items: await studyFeedItems(),
  });
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
