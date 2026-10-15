import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { archivePages, isArchivePath } from './editions.mjs';

export const onRequest = defineRouteMiddleware(({ url, locals }) => {
  const route = locals.starlightRoute;
  const archived = isArchivePath(url.pathname);
  route.head.push({
    tag: 'meta',
    attrs: {
      'data-pagefind-filter': 'edition[content]',
      content: archived ? 'v1' : 'v2',
    },
  });
  if (!archived) return;
  route.siteTitleHref = '/v1/';
  route.sidebar = archivePages.map(({ label, href }) => ({
    type: 'link',
    label,
    href,
    isCurrent: url.pathname === href,
    badge: undefined,
    attrs: {},
  }));
  route.hasSidebar = true;
  const index = archivePages.findIndex(page => page.href === url.pathname);
  route.pagination = { prev: route.sidebar[index - 1], next: route.sidebar[index + 1] };
  route.editUrl = undefined;
  route.head.push({
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'v1 archive',
          item: 'https://react-broadcast-sync-docs.vercel.app/v1/',
        },
        { '@type': 'ListItem', position: 2, name: route.entry.data.title },
      ],
    }),
  });
});
