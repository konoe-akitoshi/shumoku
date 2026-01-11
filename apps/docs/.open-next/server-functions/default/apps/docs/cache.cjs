globalThis.disableIncrementalCache = false;globalThis.disableDynamoDBCache = false;globalThis.isNextAfter15 = true;globalThis.openNextDebug = false;globalThis.openNextVersion = "3.9.7";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/adapters/cache.js
var cache_exports = {};
__export(cache_exports, {
  SOFT_TAG_PREFIX: () => SOFT_TAG_PREFIX,
  default: () => Cache
});
module.exports = __toCommonJS(cache_exports);

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/utils/error.js
function isOpenNextError(e) {
  try {
    return "__openNextInternal" in e;
  } catch {
    return false;
  }
}

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/adapters/logger.js
function debug(...args) {
  if (globalThis.openNextDebug) {
    console.log(...args);
  }
}
function warn(...args) {
  console.warn(...args);
}
var DOWNPLAYED_ERROR_LOGS = [
  {
    clientName: "S3Client",
    commandName: "GetObjectCommand",
    errorName: "NoSuchKey"
  }
];
var isDownplayedErrorLog = (errorLog) => DOWNPLAYED_ERROR_LOGS.some((downplayedInput) => downplayedInput.clientName === errorLog?.clientName && downplayedInput.commandName === errorLog?.commandName && (downplayedInput.errorName === errorLog?.error?.name || downplayedInput.errorName === errorLog?.error?.Code));
function error(...args) {
  if (args.some((arg) => isDownplayedErrorLog(arg))) {
    return debug(...args);
  }
  if (args.some((arg) => isOpenNextError(arg))) {
    const error2 = args.find((arg) => isOpenNextError(arg));
    if (error2.logLevel < getOpenNextErrorLogLevel()) {
      return;
    }
    if (error2.logLevel === 0) {
      return console.log(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    if (error2.logLevel === 1) {
      return warn(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    return console.error(...args);
  }
  console.error(...args);
}
function getOpenNextErrorLogLevel() {
  const strLevel = process.env.OPEN_NEXT_ERROR_LOG_LEVEL ?? "1";
  switch (strLevel.toLowerCase()) {
    case "debug":
    case "0":
      return 0;
    case "error":
    case "2":
      return 2;
    default:
      return 1;
  }
}

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/utils/cache.js
async function hasBeenRevalidated(key, tags, cacheEntry) {
  if (globalThis.openNextConfig.dangerous?.disableTagCache) {
    return false;
  }
  const value = cacheEntry.value;
  if (!value) {
    return true;
  }
  if ("type" in cacheEntry && cacheEntry.type === "page") {
    return false;
  }
  const lastModified = cacheEntry.lastModified ?? Date.now();
  if (globalThis.tagCache.mode === "nextMode") {
    return tags.length === 0 ? false : await globalThis.tagCache.hasBeenRevalidated(tags, lastModified);
  }
  const _lastModified = await globalThis.tagCache.getLastModified(key, lastModified);
  return _lastModified === -1;
}
function getTagsFromValue(value) {
  if (!value) {
    return [];
  }
  try {
    const cacheTags = value.meta?.headers?.["x-next-cache-tags"]?.split(",") ?? [];
    delete value.meta?.headers?.["x-next-cache-tags"];
    return cacheTags;
  } catch (e) {
    return [];
  }
}
function getTagKey(tag) {
  if (typeof tag === "string") {
    return tag;
  }
  return JSON.stringify({
    tag: tag.tag,
    path: tag.path
  });
}
async function writeTags(tags) {
  const store = globalThis.__openNextAls.getStore();
  debug("Writing tags", tags, store);
  if (!store || globalThis.openNextConfig.dangerous?.disableTagCache) {
    return;
  }
  const tagsToWrite = tags.filter((t) => {
    const tagKey = getTagKey(t);
    const shouldWrite = !store.writtenTags.has(tagKey);
    if (shouldWrite) {
      store.writtenTags.add(tagKey);
    }
    return shouldWrite;
  });
  if (tagsToWrite.length === 0) {
    return;
  }
  await globalThis.tagCache.writeTags(tagsToWrite);
}

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/utils/binary.js
var commonBinaryMimeTypes = /* @__PURE__ */ new Set([
  "application/octet-stream",
  // Docs
  "application/epub+zip",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.amazon.ebook",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Fonts
  "font/otf",
  "font/woff",
  "font/woff2",
  // Images
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/vnd.microsoft.icon",
  "image/webp",
  // Audio
  "audio/3gpp",
  "audio/aac",
  "audio/basic",
  "audio/flac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wavaudio/webm",
  "audio/x-aiff",
  "audio/x-midi",
  "audio/x-wav",
  // Video
  "video/3gpp",
  "video/mp2t",
  "video/mpeg",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  // Archives
  "application/java-archive",
  "application/vnd.apple.installer+xml",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-bzip",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-java-archive",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/x-zip",
  "application/zip",
  // Serialized data
  "application/x-protobuf"
]);
function isBinaryContentType(contentType) {
  if (!contentType)
    return false;
  const value = contentType.split(";")[0];
  return commonBinaryMimeTypes.has(value);
}

// ../../node_modules/.bun/@opennextjs+aws@3.9.7+4420658d3d69a22c/node_modules/@opennextjs/aws/dist/adapters/cache.js
var SOFT_TAG_PREFIX = "_N_T_/";
function isFetchCache(options) {
  if (typeof options === "boolean") {
    return options;
  }
  if (typeof options === "object") {
    return options.kindHint === "fetch" || options.fetchCache || options.kind === "FETCH";
  }
  return false;
}
var Cache = class {
  async get(key, options) {
    if (globalThis.openNextConfig.dangerous?.disableIncrementalCache) {
      return null;
    }
    const softTags = typeof options === "object" ? options.softTags : [];
    const tags = typeof options === "object" ? options.tags : [];
    return isFetchCache(options) ? this.getFetchCache(key, softTags, tags) : this.getIncrementalCache(key);
  }
  async getFetchCache(key, softTags, tags) {
    debug("get fetch cache", { key, softTags, tags });
    try {
      const cachedEntry = await globalThis.incrementalCache.get(key, "fetch");
      if (cachedEntry?.value === void 0)
        return null;
      const _tags = [...tags ?? [], ...softTags ?? []];
      const _lastModified = cachedEntry.lastModified ?? Date.now();
      const _hasBeenRevalidated = cachedEntry.shouldBypassTagCache ? false : await hasBeenRevalidated(key, _tags, cachedEntry);
      if (_hasBeenRevalidated)
        return null;
      if ((tags ?? []).length === 0) {
        const path = softTags?.find((tag) => tag.startsWith(SOFT_TAG_PREFIX) && !tag.endsWith("layout") && !tag.endsWith("page"));
        if (path) {
          const hasPathBeenUpdated = cachedEntry.shouldBypassTagCache ? false : await hasBeenRevalidated(path.replace(SOFT_TAG_PREFIX, ""), [], cachedEntry);
          if (hasPathBeenUpdated) {
            return null;
          }
        }
      }
      return {
        lastModified: _lastModified,
        value: cachedEntry.value
      };
    } catch (e) {
      debug("Failed to get fetch cache", e);
      return null;
    }
  }
  async getIncrementalCache(key) {
    try {
      const cachedEntry = await globalThis.incrementalCache.get(key, "cache");
      if (!cachedEntry?.value) {
        return null;
      }
      const cacheData = cachedEntry.value;
      const meta = cacheData.meta;
      const tags = getTagsFromValue(cacheData);
      const _lastModified = cachedEntry.lastModified ?? Date.now();
      const _hasBeenRevalidated = cachedEntry.shouldBypassTagCache ? false : await hasBeenRevalidated(key, tags, cachedEntry);
      if (_hasBeenRevalidated)
        return null;
      const store = globalThis.__openNextAls.getStore();
      if (store) {
        store.lastModified = _lastModified;
      }
      if (cacheData?.type === "route") {
        return {
          lastModified: _lastModified,
          value: {
            kind: globalThis.isNextAfter15 ? "APP_ROUTE" : "ROUTE",
            body: Buffer.from(cacheData.body ?? Buffer.alloc(0), isBinaryContentType(String(meta?.headers?.["content-type"])) ? "base64" : "utf8"),
            status: meta?.status,
            headers: meta?.headers
          }
        };
      }
      if (cacheData?.type === "page" || cacheData?.type === "app") {
        if (globalThis.isNextAfter15 && cacheData?.type === "app") {
          const segmentData = /* @__PURE__ */ new Map();
          if (cacheData.segmentData) {
            for (const [segmentPath, segmentContent] of Object.entries(cacheData.segmentData ?? {})) {
              segmentData.set(segmentPath, Buffer.from(segmentContent));
            }
          }
          return {
            lastModified: _lastModified,
            value: {
              kind: "APP_PAGE",
              html: cacheData.html,
              rscData: Buffer.from(cacheData.rsc),
              status: meta?.status,
              headers: meta?.headers,
              postponed: meta?.postponed,
              segmentData
            }
          };
        }
        return {
          lastModified: _lastModified,
          value: {
            kind: globalThis.isNextAfter15 ? "PAGES" : "PAGE",
            html: cacheData.html,
            pageData: cacheData.type === "page" ? cacheData.json : cacheData.rsc,
            status: meta?.status,
            headers: meta?.headers
          }
        };
      }
      if (cacheData?.type === "redirect") {
        return {
          lastModified: _lastModified,
          value: {
            kind: "REDIRECT",
            props: cacheData.props
          }
        };
      }
      warn("Unknown cache type", cacheData);
      return null;
    } catch (e) {
      debug("Failed to get body cache", e);
      return null;
    }
  }
  async set(key, data, ctx) {
    if (globalThis.openNextConfig.dangerous?.disableIncrementalCache) {
      return;
    }
    const detachedPromise = globalThis.__openNextAls.getStore()?.pendingPromiseRunner.withResolvers();
    try {
      if (data === null || data === void 0) {
        await globalThis.incrementalCache.delete(key);
      } else {
        const revalidate = this.extractRevalidateForSet(ctx);
        switch (data.kind) {
          case "ROUTE":
          case "APP_ROUTE": {
            const { body, status, headers } = data;
            await globalThis.incrementalCache.set(key, {
              type: "route",
              body: body.toString(isBinaryContentType(String(headers["content-type"])) ? "base64" : "utf8"),
              meta: {
                status,
                headers
              },
              revalidate
            }, "cache");
            break;
          }
          case "PAGE":
          case "PAGES": {
            const { html, pageData, status, headers } = data;
            const isAppPath = typeof pageData === "string";
            if (isAppPath) {
              await globalThis.incrementalCache.set(key, {
                type: "app",
                html,
                rsc: pageData,
                meta: {
                  status,
                  headers
                },
                revalidate
              }, "cache");
            } else {
              await globalThis.incrementalCache.set(key, {
                type: "page",
                html,
                json: pageData,
                revalidate
              }, "cache");
            }
            break;
          }
          case "APP_PAGE": {
            const { html, rscData, headers, status } = data;
            await globalThis.incrementalCache.set(key, {
              type: "app",
              html,
              rsc: rscData.toString("utf8"),
              meta: {
                status,
                headers
              },
              revalidate
            }, "cache");
            break;
          }
          case "FETCH":
            await globalThis.incrementalCache.set(key, data, "fetch");
            break;
          case "REDIRECT":
            await globalThis.incrementalCache.set(key, {
              type: "redirect",
              props: data.props,
              revalidate
            }, "cache");
            break;
          case "IMAGE":
            break;
        }
      }
      await this.updateTagsOnSet(key, data, ctx);
      debug("Finished setting cache");
    } catch (e) {
      error("Failed to set cache", e);
    } finally {
      detachedPromise?.resolve();
    }
  }
  async revalidateTag(tags) {
    const config = globalThis.openNextConfig.dangerous;
    if (config?.disableTagCache || config?.disableIncrementalCache) {
      return;
    }
    const _tags = Array.isArray(tags) ? tags : [tags];
    if (_tags.length === 0) {
      return;
    }
    try {
      if (globalThis.tagCache.mode === "nextMode") {
        const paths = await globalThis.tagCache.getPathsByTags?.(_tags) ?? [];
        await writeTags(_tags);
        if (paths.length > 0) {
          await globalThis.cdnInvalidationHandler.invalidatePaths(paths.map((path) => ({
            initialPath: path,
            rawPath: path,
            resolvedRoutes: [
              {
                route: path,
                // TODO: ideally here we should check if it's an app router page or route
                type: "app"
              }
            ]
          })));
        }
        return;
      }
      for (const tag of _tags) {
        debug("revalidateTag", tag);
        const paths = await globalThis.tagCache.getByTag(tag);
        debug("Items", paths);
        const toInsert = paths.map((path) => ({
          path,
          tag
        }));
        if (tag.startsWith(SOFT_TAG_PREFIX)) {
          for (const path of paths) {
            const _tags2 = await globalThis.tagCache.getByPath(path);
            const hardTags = _tags2.filter((t) => !t.startsWith(SOFT_TAG_PREFIX));
            for (const hardTag of hardTags) {
              const _paths = await globalThis.tagCache.getByTag(hardTag);
              debug({ hardTag, _paths });
              toInsert.push(..._paths.map((path2) => ({
                path: path2,
                tag: hardTag
              })));
            }
          }
        }
        await writeTags(toInsert);
        const uniquePaths = Array.from(new Set(toInsert.filter((t) => t.tag.startsWith(SOFT_TAG_PREFIX)).map((t) => `/${t.path}`)));
        if (uniquePaths.length > 0) {
          await globalThis.cdnInvalidationHandler.invalidatePaths(uniquePaths.map((path) => ({
            initialPath: path,
            rawPath: path,
            resolvedRoutes: [
              {
                route: path,
                // TODO: ideally here we should check if it's an app router page or route
                type: "app"
              }
            ]
          })));
        }
      }
    } catch (e) {
      error("Failed to revalidate tag", e);
    }
  }
  // TODO: We should delete/update tags in this method
  // This will require an update to the tag cache interface
  async updateTagsOnSet(key, data, ctx) {
    if (globalThis.openNextConfig.dangerous?.disableTagCache || globalThis.tagCache.mode === "nextMode" || // Here it means it's a delete
    !data) {
      return;
    }
    const derivedTags = data?.kind === "FETCH" ? (
      //@ts-expect-error - On older versions of next, ctx was a number, but for these cases we use data?.data?.tags
      ctx?.tags ?? data?.data?.tags ?? []
    ) : data?.kind === "PAGE" ? data.headers?.["x-next-cache-tags"]?.split(",") ?? [] : [];
    debug("derivedTags", derivedTags);
    const storedTags = await globalThis.tagCache.getByPath(key);
    const tagsToWrite = derivedTags.filter((tag) => !storedTags.includes(tag));
    if (tagsToWrite.length > 0) {
      await writeTags(tagsToWrite.map((tag) => ({
        path: key,
        tag,
        // In case the tags are not there we just need to create them
        // but we don't want them to return from `getLastModified` as they are not stale
        revalidatedAt: 1
      })));
    }
  }
  extractRevalidateForSet(ctx) {
    if (ctx === void 0) {
      return void 0;
    }
    if (typeof ctx === "number" || ctx === false) {
      return ctx;
    }
    if ("revalidate" in ctx) {
      return ctx.revalidate;
    }
    if ("cacheControl" in ctx) {
      return ctx.cacheControl?.revalidate;
    }
    return void 0;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SOFT_TAG_PREFIX
});
