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
      sidebar: [
        { label: 'Getting Started', slug: 'getting-started' },
        {
          label: 'Demos',
          items: [
            {
              label: 'Live demo',
              link: 'https://react-broadcast-sync-3w3m.vercel.app/',
              attrs: { target: '_blank', rel: 'noopener' },
            },
          ],
        },
      ],
    }),
  ],
});
