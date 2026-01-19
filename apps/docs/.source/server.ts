// @ts-nocheck
import * as __fd_glob_17 from "../content/docs/netbox/visualization.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/netbox/index.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/netbox/api.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/yaml-reference.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/vendor-icons.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/styling-themes.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/organizing-groups.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/multi-file.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/json-reference.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/interactive-features.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/examples.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/custom-integration.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/cli.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/basic-diagram.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/about.mdx?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/netbox/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "netbox/meta.json": __fd_glob_1, }, {"about.mdx": __fd_glob_2, "basic-diagram.mdx": __fd_glob_3, "cli.mdx": __fd_glob_4, "custom-integration.mdx": __fd_glob_5, "examples.mdx": __fd_glob_6, "index.mdx": __fd_glob_7, "interactive-features.mdx": __fd_glob_8, "json-reference.mdx": __fd_glob_9, "multi-file.mdx": __fd_glob_10, "organizing-groups.mdx": __fd_glob_11, "styling-themes.mdx": __fd_glob_12, "vendor-icons.mdx": __fd_glob_13, "yaml-reference.mdx": __fd_glob_14, "netbox/api.mdx": __fd_glob_15, "netbox/index.mdx": __fd_glob_16, "netbox/visualization.mdx": __fd_glob_17, });