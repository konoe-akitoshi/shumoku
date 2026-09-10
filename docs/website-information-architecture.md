# Website information architecture

## Decision

The website serves discovery, experimentation and project communication. Docs serves
maintained usage instructions. Do not put dated event reports in the reference docs.

| Destination | Reader intent | Content |
| --- | --- | --- |
| Home | Understand the product | Overview, features, examples, entry points |
| Docs | Learn and look up | Installation, current usage, reference |
| Playground | Try it | Interactive workspace |
| Blog | Follow the project | Event reports, development stories, release introductions, use cases |
| About | Understand the project | Purpose, identity, design background |
| Community | Participate | Questions, events, contribution, governance and public support |
| Support / For teams | Evaluate commercial help | Deployment, integration and operations services |
| connpass (external) | Participate | Event dates, venues and registration |

Header order: Docs, Playground, Blog, Community, For teams (導入相談). About remains
in the footer and contextual links; its URL is unchanged. Footer groups remain
Use Shumoku / Project / Support. Home provides an activity entry point rather than
claiming that unpublished articles are recent news. The shared `sitePages` registry
feeds navigation and the sitemap, including Japanese and English Blog routes.

Community now gathers the existing Discord, GitHub Discussions, Issues, contribution
guides and connpass destinations. connpass alone is not a community hub. No separate
Events, News or Resources page yet: reconsider Events when an on-site archive of
multiple events becomes useful.

## Open-source identity and commercial positioning

Shumoku aims to occupy the space between a community-led OSS project and a
commercial infrastructure product. Do not bury the commercial route in the footer,
or imply that community participation is only for individuals. Keep both paths visible.
This is a positioning decision, not a new pricing, licensing or SLA program.

The Home sequence is overview → adopters and visual examples → features and
integrations → product forms → getting started → project activity → FAQ. The hero
explicitly connects open-source deployment with optional hands-on commercial help.
Community links to commercial support for private/environment-specific work;
Support links back to public community channels and self-service documentation.

[Zabbix](https://www.zabbix.com/) separates Community from Services while presenting
an open-source product for enterprise use. [NetBox Labs](https://netboxlabs.com/)
also exposes community and commercial offerings. Shumoku borrows this separation
of reader intent, not their feature tiers, commercial promises or navigation size.
The wording follows repository `SUPPORT.md`, `COMMERCIAL_SUPPORT.md` and
`GOVERNANCE.md`: no invented enterprise edition, price, response time or warranty.
The existing `/support#enterprise` link remains valid.

## Publishing follow-up

Blog articles are ordinary Markdown bundles: `src/content/blog/<slug>/index.md`
and a sibling `images/` folder. Frontmatter drives listings, dates and the sitemap;
relative Markdown images are resolved at build time. See the authoring README in
`apps/website/src/content/blog/`. No CMS or article-specific Svelte code is needed.
The first report uses the supplied Meetup #1 photos and factual captions. Author
credits have not been invented. Untranslated pages show the original text with a
notice, following Docs; the article content itself remains Japanese only.
Community photo selection and assets are independent of article bundles.

When implementing article publishing, use one collection with locale, stable slug,
title, description, author, publication date and category. Keep draft content out of
lists, sitemap and direct public routes. Add a category filter only when real articles
justify it; do not create empty category pages. Use `/[lang]/blog/[slug]` for articles.
Only advertise language alternates for translations that exist.

Reports should link to the original event, slides or recordings when available,
and the community registration page. Keep the event date distinct from the article's
publication date. Temporary header announcements are promotional links, not archives.

## Research and rationale

These are qualitative precedents, not a claim that every OSS site needs the same pages.
The inventory includes footer and related official sites, not only header navigation.

- [Godot Blog / Events](https://godotengine.org/blog/events/) groups announcements
  and reports within a shared Blog; [Events](https://godotengine.org/events/) serves
  participation. [GodotCon US 2025 report](https://godotengine.org/article/godotcon-us-2025-wrapup/)
  demonstrates the dated-report format.
- [Zabbix Summit report](https://blog.zabbix.com/community-coffee-and-code-a-zabbix-summit-2025-recap/31577/)
  is a blog article with event coverage and recordings, rather than product documentation.
- [draw.io](https://www.drawio.com/) prioritizes the tool, documentation and integrations;
  its [Blog](https://www.drawio.com/blog/) provides a compact publishing destination.
- [Kubernetes Community](https://kubernetes.io/community/), [Rust](https://rust-lang.org/)
  and [PostgreSQL](https://www.postgresql.org/) distinguish learning, participation
  and project updates. Their community scale does not imply Shumoku needs all their pages.
- [NetBox Labs](https://netboxlabs.com/), [Zabbix](https://www.zabbix.com/) and
  [Grafana Labs](https://grafana.com/) include enterprise resources such as customer
  stories and services. Do not copy vendor-site complexity without corresponding content.
- [LibreNMS](https://www.librenms.org/) is a compact tool-first counterexample.
  [Mermaid](https://mermaid.js.org/) emphasizes docs and integrations, with related
  publishing and community destinations also on [mermaid.ai](https://mermaid.ai/).

## Layout

Following the Muller-Brockmann grid skill, new sections reuse `site-container` for
shared outer edges, existing spacing tokens for gutters and a single-column narrow
layout. No new card borders, palette, typography system or decorative grid overlay.
