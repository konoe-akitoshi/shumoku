import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

const navTitle = (
  <>
    <img src="/logo.svg" alt="Shumoku" className="h-6 w-6" />
    <span>Shumoku</span>
  </>
);

const navLinks = [
  {
    text: 'Docs',
    url: '/docs',
  },
  {
    text: 'Playground',
    url: '/playground',
  },
];

// For home page and playground
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: navTitle,
    },
    links: navLinks,
    githubUrl: 'https://github.com/konoe-akitoshi/shumoku',
  };
}

// For docs pages (no links in sidebar)
export function docsOptions(): BaseLayoutProps {
  return {
    nav: {
      title: navTitle,
    },
    githubUrl: 'https://github.com/konoe-akitoshi/shumoku',
  };
}
