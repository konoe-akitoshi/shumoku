// @ts-nocheck
import * as __fd_glob_11 from "../content/docs/netbox/visualization.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/netbox/index.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/netbox/api.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/yaml-reference.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/vendor-icons.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/json-reference.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/examples.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/cli.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/api-reference.mdx?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/netbox/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "netbox/meta.json": __fd_glob_1, }, {"api-reference.mdx": __fd_glob_2, "cli.mdx": __fd_glob_3, "examples.mdx": __fd_glob_4, "index.mdx": __fd_glob_5, "json-reference.mdx": __fd_glob_6, "vendor-icons.mdx": __fd_glob_7, "yaml-reference.mdx": __fd_glob_8, "netbox/api.mdx": __fd_glob_9, "netbox/index.mdx": __fd_glob_10, "netbox/visualization.mdx": __fd_glob_11, });