// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"about.mdx": () => import("../content/docs/about.mdx?collection=docs"), "basic-diagram.mdx": () => import("../content/docs/basic-diagram.mdx?collection=docs"), "cli.mdx": () => import("../content/docs/cli.mdx?collection=docs"), "custom-integration.mdx": () => import("../content/docs/custom-integration.mdx?collection=docs"), "examples.mdx": () => import("../content/docs/examples.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "interactive-features.mdx": () => import("../content/docs/interactive-features.mdx?collection=docs"), "json-reference.mdx": () => import("../content/docs/json-reference.mdx?collection=docs"), "multi-file.mdx": () => import("../content/docs/multi-file.mdx?collection=docs"), "organizing-groups.mdx": () => import("../content/docs/organizing-groups.mdx?collection=docs"), "styling-themes.mdx": () => import("../content/docs/styling-themes.mdx?collection=docs"), "vendor-icons.mdx": () => import("../content/docs/vendor-icons.mdx?collection=docs"), "yaml-reference.mdx": () => import("../content/docs/yaml-reference.mdx?collection=docs"), "netbox/api.mdx": () => import("../content/docs/netbox/api.mdx?collection=docs"), "netbox/index.mdx": () => import("../content/docs/netbox/index.mdx?collection=docs"), "netbox/visualization.mdx": () => import("../content/docs/netbox/visualization.mdx?collection=docs"), }),
};
export default browserCollections;