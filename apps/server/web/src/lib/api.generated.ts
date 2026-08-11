// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check server liveness */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The server process is running */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Health"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List topologies */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology shells ordered by name */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyList"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Create a topology */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateTopology"];
                };
            };
            responses: {
                /** @description Created topology shell */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Topology"];
                    };
                };
                /** @description The request did not match the API contract */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a topology */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology shell */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Topology"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The topology does not exist */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Update a topology */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateTopology"];
                };
            };
            responses: {
                /** @description Updated topology shell */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Topology"];
                    };
                };
                /** @description The request did not match the API contract */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The topology does not exist */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        /** Delete a topology */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DeleteTopologyResult"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The topology does not exist */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get build and update information */
        get: {
            parameters: {
                query?: {
                    /** @description Refresh cached release information when true */
                    refresh?: "true" | "false";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Build and release information */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SystemInfo"];
                    };
                };
                /** @description The request did not match the API contract */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Inspect server runtime status
         * @description Returns redacted operational state for diagnostics and automation.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Current runtime status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminStatus"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Health: {
            /** @enum {string} */
            status: "ok";
            timestamp: number;
            build: components["schemas"]["BuildInfo"];
        };
        BuildInfo: {
            version: string;
            /** @enum {string} */
            channel: "stable" | "beta" | "development";
            commit?: string;
            builtAt?: string;
            /** @enum {string} */
            deployment: "docker" | "docker-compose" | "kubernetes" | "source";
        };
        TopologyList: components["schemas"]["Topology"][];
        Topology: {
            id: string;
            name: string;
            /** @enum {string} */
            compositionMode: "additive" | "enrichment";
            /** @enum {string} */
            scopeMode: "auto" | "open" | "closed";
            scopeSourceId?: string;
            scope: {
                include?: {
                    /** @enum {string} */
                    attr: "name" | "subnet" | "metadata";
                    value: string;
                    key?: string;
                }[];
                exclude?: {
                    /** @enum {string} */
                    attr: "name" | "subnet" | "metadata";
                    value: string;
                    key?: string;
                }[];
            };
            metricsSourceId?: string;
            mappingJson?: string;
            shareToken?: string;
            createdAt: number;
            updatedAt: number;
        };
        Error: {
            error: string;
        };
        CreateTopology: {
            name: string;
        };
        UpdateTopology: {
            name?: string;
        };
        DeleteTopologyResult: {
            /** @enum {boolean} */
            success: true;
        };
        SystemInfo: {
            build: components["schemas"]["BuildInfo"];
            update: components["schemas"]["UpdateInfo"];
        };
        UpdateInfo: {
            /** @enum {string} */
            status: "available" | "current" | "unknown" | "disabled";
            currentVersion: string;
            latestVersion?: string;
            releaseUrl?: string;
            publishedAt?: string;
            checkedAt?: string;
            error?: string;
        };
        AdminStatus: {
            /** @enum {string} */
            status: "ok" | "degraded";
            timestamp: number;
            uptimeSeconds: number;
            database: {
                ready: boolean;
            };
            topologies: {
                database: number;
                legacyFile: number;
            };
            plugins: {
                registered: number;
            };
            realtime: {
                webSocketClients: number;
                sseSubscribers: number;
            };
            schedulers: {
                metrics: {
                    running: boolean;
                    activePolls: number;
                    queuedPolls: number;
                    topologyCount: number;
                    watchedTopologies: number;
                    inFlightTopologies: number;
                    fastIntervalMs: number;
                    slowIntervalMs: number;
                    concurrencyLimit: number;
                };
                discovery: {
                    running: boolean;
                    tickInFlight: boolean;
                    tickIntervalMs: number;
                    minimumSyncIntervalMs: number;
                };
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
