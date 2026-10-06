// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://react-broadcast-sync.vercel.app',
  integrations: [
    starlight({
      title: 'react-broadcast-sync',
      logo: {
        src: './src/assets/logo.png',
        alt: 'react-broadcast-sync logo',
      },
      favicon: '/favicon.png',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/IdanShalem/react-broadcast-sync',
        },
        {
          icon: 'npm',
          label: 'npm',
          href: 'https://www.npmjs.com/package/react-broadcast-sync',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        Header: './src/components/Header.astro',
      },
      sidebar: [
        { label: 'Getting Started', slug: 'getting-started' },
        {
          label: 'Concepts',
          items: [
            { label: 'How It Works', slug: 'concepts/how-it-works' },
            { label: 'Messages and Channels', slug: 'concepts/messages-and-channels' },
            { label: 'Tabs and Identity', slug: 'concepts/tabs-and-identity' },
            { label: 'Why Not localStorage?', slug: 'concepts/why-not-localstorage' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Use the Hook', slug: 'guides/use-the-hook' },
            { label: 'Use the Provider', slug: 'guides/use-the-provider' },
            { label: 'Hook or Provider?', slug: 'guides/hook-or-provider' },
            { label: 'Sync Shared State', slug: 'guides/sync-shared-state' },
            { label: 'Message Lifecycle', slug: 'guides/message-lifecycle' },
            { label: 'Performance', slug: 'guides/performance' },
            { label: 'Telemetry', slug: 'guides/telemetry' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'useBroadcastChannel', slug: 'api/use-broadcast-channel' },
            { label: 'BroadcastActions', slug: 'api/broadcast-actions' },
            { label: 'BroadcastProvider', slug: 'api/broadcast-provider' },
            { label: 'Types', slug: 'api/types' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Real-time Notifications', slug: 'recipes/notifications' },
            { label: 'Multi-tab Form Sync', slug: 'recipes/form-sync' },
            { label: 'Tab Presence', slug: 'recipes/tab-presence' },
            { label: 'Late-joining Tabs', slug: 'recipes/late-tabs' },
          ],
        },
        {
          label: 'Tutorial',
          items: [{ label: 'Build the Counter Demo', slug: 'tutorial/build-the-counter-demo' }],
        },
        {
          label: 'Demos',
          items: [
            {
              label: 'Hook demo',
              link: '/demos/hook/',
              attrs: { target: '_blank', rel: 'noopener' },
            },
            {
              label: 'Provider demo',
              link: '/demos/provider/',
              attrs: { target: '_blank', rel: 'noopener' },
            },
          ],
        },
        { label: 'FAQ', slug: 'faq' },
        { label: 'Troubleshooting', slug: 'troubleshooting' },
        { label: 'Changelog and Migration', slug: 'changelog' },
      ],
    }),
  ],
});
