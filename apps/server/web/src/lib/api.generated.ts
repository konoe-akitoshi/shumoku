// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

export interface paths {
    "/auth/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get authentication status */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Authentication state */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthStatus"];
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
    "/auth/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Configure the initial administrator password */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PasswordRequest"];
                };
            };
            responses: {
                /** @description Operation completed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthSuccess"];
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
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an administrator session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PasswordRequest"];
                };
            };
            responses: {
                /** @description Operation completed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthSuccess"];
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
                /** @description The password is invalid */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Too many login attempts */
                429: {
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
    "/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change the administrator password */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChangePasswordRequest"];
                };
            };
            responses: {
                /** @description Operation completed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthSuccess"];
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
                /** @description Authentication or current password is invalid */
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
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** End the current administrator session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operation completed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthSuccess"];
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
    "/share/topologies/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get shared topology context */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shared topology context */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyContext"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/topologies/{token}/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get shared topology graph */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shared topology graph */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyGraph"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/topologies/{token}/view": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get shared topology graph and layout */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shared topology view */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyView"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/topologies/{token}/render": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Render a shared topology */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shared topology render */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyRender"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/topologies/{token}/metrics/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream shared topology metrics */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Metrics event stream */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                503: {
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
    "/share/dashboards/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a shared dashboard */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shared dashboard */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PublicDashboard"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/dashboards/{token}/topologies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get shared dashboard topology metadata */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology metadata */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PublicTopologyMetadata"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/dashboards/{token}/topologies/{id}/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a shared dashboard topology graph */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology graph */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyGraph"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/dashboards/{token}/topologies/{id}/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get shared dashboard topology context */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Topology context */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyContext"];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/share/dashboards/{token}/topologies/{id}/metrics/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream shared dashboard topology metrics */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Metrics event stream */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                503: {
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
    "/share/dashboards/{token}/datasources/{id}/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get alerts for a shared dashboard widget */
        get: {
            parameters: {
                query?: {
                    timeRange?: number | null;
                    activeOnly?: string;
                    minSeverity?: "critical" | "high" | "medium" | "low" | "info" | "ok";
                };
                header?: never;
                path: {
                    token: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Projected alerts */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PublicAlert"][];
                    };
                };
                /** @description Shared resource unavailable */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Shared resource unavailable */
                500: {
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
    "/datasources/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List available data source plugin types */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Registered plugin types and their form schemas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSourcePluginList"];
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
    "/datasources/by-capability/{capability}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List data sources by capability */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    capability: "topology" | "metrics" | "alerts";
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Configured data sources supporting the capability */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSourceList"];
                    };
                };
                /** @description The capability is not supported */
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
    "/datasources/{id}/config-options/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get dynamic configuration options */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Available values for the requested plugin schema field */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConfigOptionsResult"];
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
                /** @description The data source does not exist */
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
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/datasources/{id}/connection-info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get derived connection information */
        get: {
            parameters: {
                query?: {
                    origin?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Display-only connection information supplied by the plugin */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConnectionInfoResult"];
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
    "/datasources/{id}/topologies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List attached topologies */
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
                /** @description Topologies currently using the data source */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AttachedTopologyList"];
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
                /** @description The data source does not exist */
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
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/datasources/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Test a data source connection */
        post: {
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
                /** @description Connection test result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConnectionResult"];
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
    "/datasources/{id}/hosts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List hosts from a data source */
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
                /** @description Hosts exposed by the plugin */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HostList"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/hosts/{hostId}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List metric items for a host */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    hostId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Host metric items */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HostItemList"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/hosts/{hostId}/neighbors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List interface neighbors for a host */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    hostId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description LLDP or CDP interface neighbors */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InterfaceNeighborList"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/hosts/{hostId}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Discover metrics for a host */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    hostId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Metrics currently exposed for the host */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoveredMetricList"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/filter-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get legacy topology filter options
         * @description Compatibility endpoint for NetBox site and tag selectors. Prefer config-options for new plugins.
         */
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
                /** @description Available sites and tags */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FilterOptions"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get alerts from a data source */
        get: {
            parameters: {
                query?: {
                    timeRange?: number | null;
                    activeOnly?: string;
                    minSeverity?: "critical" | "high" | "medium" | "low" | "info" | "ok";
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Alerts returned by the plugin */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AlertList"];
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
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/_native": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Call a plugin native API method
         * @description Development-only escape hatch for loopback API automation.
         */
        post: {
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
                    "application/json": components["schemas"]["NativeApiRequest"];
                };
            };
            responses: {
                /** @description Raw upstream result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NativeApiResult"];
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
                /** @description Unavailable outside development or data source not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The upstream data source request failed */
                500: {
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
    "/datasources/{id}/scan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run an ad-hoc topology scan */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["DataSourceScanRequest"];
                };
            };
            responses: {
                /** @description Scan snapshot and optional persisted observation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSourceScanResult"];
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
                /** @description The data source does not exist */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The scan failed */
                500: {
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
    "/dashboards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List dashboards */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Configured dashboards */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DashboardList"];
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
        /** Create a dashboard */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDashboard"];
                };
            };
            responses: {
                /** @description Created dashboard */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Dashboard"];
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
    "/dashboards/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a dashboard */
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
                /** @description Dashboard */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Dashboard"];
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
                /** @description The dashboard does not exist */
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
        /** Update a dashboard */
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
                    "application/json": components["schemas"]["UpdateDashboard"];
                };
            };
            responses: {
                /** @description Updated dashboard */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Dashboard"];
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
                /** @description The dashboard does not exist */
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
        /** Delete a dashboard */
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
                /** @description Dashboard deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Success"];
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
                /** @description The dashboard does not exist */
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
    "/dashboards/{id}/share": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enable dashboard sharing */
        post: {
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
                /** @description Generated share token */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DashboardShareResult"];
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
                /** @description The dashboard does not exist */
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
        /** Disable dashboard sharing */
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
                /** @description Sharing disabled */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Success"];
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
                /** @description The dashboard does not exist */
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
    "/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List settings */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description All settings */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Settings"];
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
        /** Update settings */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["Settings"];
                };
            };
            responses: {
                /** @description Settings updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingsSuccess"];
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
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/settings/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a setting */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Setting */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Setting"];
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
                /** @description The setting does not exist */
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
        /** Update a setting */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    key: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SettingValue"];
                };
            };
            responses: {
                /** @description Updated setting */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Setting"];
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
        post?: never;
        /** Delete a setting */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Setting deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingsSuccess"];
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
                /** @description The setting does not exist */
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
    "/plugins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List installed plugins */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Installed plugins */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginList"];
                    };
                };
            };
        };
        put?: never;
        /** Install an external plugin */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["InstallPlugin"];
                };
            };
            responses: {
                /** @description Installed plugin */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginInfo"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
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
    "/plugins/{id}/manifest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an external plugin manifest */
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
                /** @description Plugin manifest */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginManifest"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
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
    "/plugins/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Install an external plugin from a ZIP archive */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        file: string;
                        subdirectory?: string;
                    };
                };
            };
            responses: {
                /** @description Installed plugin */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginInfo"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
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
    "/plugins/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove an external plugin */
        delete: {
            parameters: {
                query?: {
                    deleteFiles?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Plugin removed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginSuccess"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
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
        /** Enable or disable an external plugin */
        patch: {
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
                    "application/json": components["schemas"]["SetPluginEnabled"];
                };
            };
            responses: {
                /** @description Plugin state updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PluginSuccess"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/plugins/reload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reload external plugins */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Reload result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReloadPluginsResult"];
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
                /** @description Plugin not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Plugin operation failed */
                500: {
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
    "/datasources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List data sources */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Configured data sources ordered by creation time */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSourceList"];
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
        /** Create a data source */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDataSource"];
                };
            };
            responses: {
                /** @description Created data source */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSource"];
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
    "/datasources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a data source */
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
                /** @description Configured data source */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSource"];
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
                /** @description The data source does not exist */
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
        /** Update a data source */
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
                    "application/json": components["schemas"]["UpdateDataSource"];
                };
            };
            responses: {
                /** @description Updated data source */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataSource"];
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
                /** @description The data source does not exist */
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
        /** Delete a data source */
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
                /** @description Data source deleted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DeleteDataSourceResult"];
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
                /** @description The data source does not exist */
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
    "/topologies/{id}/observations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent topology observations */
        get: {
            parameters: {
                query?: {
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Observation summaries */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: string;
                            topologyId: string;
                            sourceId: string;
                            capturedAt: number;
                            /** @enum {string} */
                            status: "ok" | "partial" | "failed" | "empty";
                            statusMessage?: string;
                            nodeCount: number;
                            linkCount: number;
                            portCount: number;
                            createdAt: number;
                        }[];
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
    "/topologies/{id}/observations/{obsId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a topology observation */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    obsId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Observation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyObservation"];
                    };
                };
                /** @description Resource not found */
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
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies/{topologyId}/sources/{sourceId}/latest-snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the latest snapshot from a topology source */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Latest snapshot */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LatestTopologySnapshot"];
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
    "/topologies/{topologyId}/sources/{sourceId}/observation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a pushed topology observation */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        graph: components["schemas"]["NetworkGraph"];
                        /**
                         * @default ok
                         * @enum {string}
                         */
                        status?: "ok" | "partial" | "failed" | "empty";
                    };
                };
            };
            responses: {
                /** @description Recorded observation */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            observation: components["schemas"]["TopologyObservation"];
                        };
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
                /** @description Operation failed */
                500: {
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
    "/topologies/{id}/resolved": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the resolved topology graph */
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
                /** @description Resolved graph */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResolvedTopology"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{id}/display-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get topology display settings */
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
                /** @description Display settings */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDisplaySettings"];
                    };
                };
            };
        };
        /** Update topology display settings */
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
                    "application/json": components["schemas"]["UpdateTopologyDisplaySettings"];
                };
            };
            responses: {
                /** @description Settings updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OkResult"];
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
                /** @description Operation failed */
                500: {
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
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies/{id}/mapping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a topology metrics mapping */
        get: {
            parameters: {
                query?: {
                    sourceId?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Metrics mapping */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MetricsMapping"];
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Replace a topology metrics mapping */
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
                    "application/json": {
                        mapping: components["schemas"]["MetricsMapping"];
                        sourceId?: string;
                    };
                };
            };
            responses: {
                /** @description Updated mapping */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Topology"] & {
                            skipped: {
                                nodes: number;
                                links: number;
                            };
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies/{id}/mapping/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List source-qualified metrics mappings */
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
                /** @description Source mappings */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            sourceId: string;
                            sourceName: string;
                            priority: number;
                            mapping: components["schemas"]["MetricsMapping"];
                        }[];
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/orphans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List orphaned metrics mappings */
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
                /** @description Mapping orphans */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            orphans: {
                                entityId: string;
                                kind: string;
                                sourceId: string;
                                payload?: unknown;
                            }[];
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/orphans/{entityId}/reassign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reassign an orphaned mapping */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    entityId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        toEntityId: string;
                    };
                };
            };
            responses: {
                /** @description Mapping reassigned */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MappingSuccess"];
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/orphans/{entityId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Discard an orphaned mapping */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    entityId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mapping discarded */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MappingSuccess"];
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/registry/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reset the topology entity registry and mappings */
        post: {
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
                /** @description Registry reset */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MappingSuccess"];
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/nodes/{nodeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Replace one node mapping */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    nodeId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        hostId?: string;
                        hostName?: string;
                        sourceId?: string;
                    };
                };
            };
            responses: {
                /** @description Updated node mapping */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            success: true;
                            topology: components["schemas"]["Topology"];
                            nodeMapping: {
                                hostId?: string;
                                hostName?: string;
                            } | null;
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/topologies/{id}/mapping/links/{linkId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Replace one link mapping */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    linkId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        monitoredNodeId?: string;
                        interface?: string;
                        bandwidth?: number;
                        sourceId?: string;
                    };
                };
            };
            responses: {
                /** @description Updated link mapping */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            success: true;
                            topology: components["schemas"]["Topology"];
                            linkMapping: {
                                monitoredNodeId?: string;
                                interface?: string;
                                bandwidth?: number;
                            } | null;
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/topologies/{id}/mapping/nodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete node mappings */
        delete: {
            parameters: {
                query?: {
                    sourceId?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted mapping count */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            deleted: number;
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete link mappings */
        delete: {
            parameters: {
                query?: {
                    sourceId?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted mapping count */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            deleted: number;
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/mapping/auto-map-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Automatically map topology links */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        overwrite?: boolean;
                        sourceId?: string;
                    };
                };
            };
            responses: {
                /** @description Auto-map result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            matched: number;
                            total: number;
                            skipped: number;
                        };
                    };
                };
                /** @description Mapping operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Mapping operation failed */
                500: {
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
    "/topologies/{id}/parsed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get parsed topology and layout */
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
                /** @description Get parsed topology and layout */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ParsedTopology"];
                    };
                };
                /** @description The initial topology derivation is still running */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDeriving"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the resolved topology graph */
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
                /** @description Get the resolved topology graph */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyGraph"];
                    };
                };
                /** @description The initial topology derivation is still running */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDeriving"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/view": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get graph and server-baked layout */
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
                /** @description Get graph and server-baked layout */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyView"];
                    };
                };
                /** @description The initial topology derivation is still running */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDeriving"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/render": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Render a topology for embedding */
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
                /** @description Render a topology for embedding */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyRender"];
                    };
                };
                /** @description The initial topology derivation is still running */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDeriving"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get simplified topology context */
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
                /** @description Get simplified topology context */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyContext"];
                    };
                };
                /** @description The initial topology derivation is still running */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDeriving"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/composition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get topology composition policy */
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
                /** @description Topology composition policy */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyComposition"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
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
        /** Update topology composition policy */
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
                    "application/json": {
                        /** @enum {string} */
                        scopeMode?: "auto" | "open" | "closed";
                        scopeSourceId?: string | null;
                        scope?: {
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
                        /** @enum {string} */
                        compositionMode?: "additive" | "enrichment";
                    };
                };
            };
            responses: {
                /** @description Updated composition policy */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyComposition"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/topologies/{topologyId}/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List attached topology data sources */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Attached sources */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDataSource"][];
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Replace all attached sources */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        sources: {
                            dataSourceId: string;
                            /** @enum {string} */
                            purpose: "topology" | "metrics";
                            /** @enum {string} */
                            syncMode?: "manual" | "on_view" | "webhook";
                            priority?: number;
                            optionsJson?: string;
                            /** @enum {string} */
                            nodeContribution?: "scoop" | "anchor";
                            /** @enum {string} */
                            linkContribution?: "add" | "update";
                        }[];
                    };
                };
            };
            responses: {
                /** @description Attached sources */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDataSource"][];
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Attach a data source to a topology */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AddTopologySource"];
                };
            };
            responses: {
                /** @description Attached source */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDataSource"] | {
                            dataSourceId: string;
                        };
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{topologyId}/sources/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a topology source attachment */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateTopologySource"];
                };
            };
            responses: {
                /** @description Updated source */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologyDataSource"];
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
        /** Detach a topology source */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Source detached */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologySourceSuccess"];
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{topologyId}/sources/{sourceId}/clear": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clear a source contribution without detaching it */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Contribution cleared */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologySourceSuccess"] & {
                            deleted: number;
                        };
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{topologyId}/sources/{sourceId}/probe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Deep-read selected source targets */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        seeds: string[];
                    };
                };
            };
            responses: {
                /** @description Probe observation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            observation: components["schemas"]["TopologyObservation"];
                        };
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{topologyId}/sources/{sourceId}/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Synchronize one attached topology source */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    topologyId: string;
                    sourceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Source snapshot and observation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SyncTopologySourceResult"];
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
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Source already attached */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Operation failed */
                500: {
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
    "/topologies/{id}/sync-from-source": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Synchronize all topology sources */
        post: {
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
                /** @description Sync job started */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StartedTopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A sync job is already running */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StartedTopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/rebuild": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clear pull-source observations and rebuild */
        post: {
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
                /** @description Sync job started */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StartedTopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A sync job is already running */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StartedTopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/sync-job": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the current or last sync job */
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
                /** @description Sync job state */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/sync-job/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel the current sync job */
        post: {
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
                /** @description Sync job state */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TopologySyncJobResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/share": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enable topology sharing */
        post: {
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
                /** @description Share token */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShareTopologyResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Disable topology sharing */
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
                /** @description Sharing disabled */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UnshareTopologyResult"];
                    };
                };
                /** @description Topology operation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Topology operation failed */
                500: {
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
    "/topologies/{id}/discovery-policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get effective per-node discovery policy */
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
                /** @description Discovery policy */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoveryPolicy"];
                    };
                };
                /** @description Topology or node not found */
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
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update topology or node discovery policy */
        patch: {
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
                    "application/json": {
                        /** @enum {string} */
                        scope: "topology" | "node";
                        id?: string;
                        attachments?: ({
                            /** @enum {string} */
                            kind: "access";
                            /** @enum {string} */
                            protocol: "snmp";
                            community?: string;
                        } | {
                            /** @enum {string} */
                            kind: "policy";
                            /** @enum {string} */
                            mode?: "auto" | "observe" | "disabled";
                            intervalMs?: number;
                        })[] | null;
                        label?: string | null;
                        suppressedAttachments?: string[] | null;
                    };
                };
            };
            responses: {
                /** @description Effective policy after update */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            effective: {
                                /** @enum {string} */
                                mode: "auto" | "observe" | "disabled";
                                intervalMs: number;
                                community?: string;
                                source: {
                                    /** @enum {string} */
                                    mode: "node" | "subgraph" | "topology" | "default";
                                    /** @enum {string} */
                                    intervalMs: "node" | "subgraph" | "topology" | "default";
                                    /** @enum {string} */
                                    community: "node" | "subgraph" | "topology" | "default";
                                };
                            };
                        };
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
                /** @description Topology or node not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The node cannot be safely updated */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Discovery policy operation failed */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/topologies/{id}/discovery-policy/exclusions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exclude a node identity from discovery */
        post: {
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
                    "application/json": {
                        mgmtIp?: string;
                        chassisId?: string;
                        sysName?: string;
                    };
                };
            };
            responses: {
                /** @description Current exclusions */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exclusions: {
                                mgmtIp?: string;
                                chassisId?: string;
                                sysName?: string;
                            }[];
                        };
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
                /** @description Topology or node not found */
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
        /** Remove a node identity exclusion */
        delete: {
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
                    "application/json": {
                        mgmtIp?: string;
                        chassisId?: string;
                        sysName?: string;
                    };
                };
            };
            responses: {
                /** @description Current exclusions */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            exclusions: {
                                mgmtIp?: string;
                                chassisId?: string;
                                sysName?: string;
                            }[];
                        };
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
                /** @description Topology or node not found */
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
    "/webhooks/{type}/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Receive a data source webhook */
        post: {
            parameters: {
                query?: {
                    secret?: string;
                };
                header?: never;
                path: {
                    type: string;
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            responses: {
                /** @description Webhook processed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WebhookResult"];
                    };
                };
                /** @description Webhook rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Webhook rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Webhook rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Webhook rejected */
                500: {
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
    "/webhooks/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check webhook ingress health */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Webhook ingress is healthy */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WebhookHealth"];
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
        AuthStatus: {
            setupComplete: boolean;
            authenticated: boolean;
        };
        AuthSuccess: {
            /** @enum {boolean} */
            success: true;
        };
        Error: {
            error: string;
        };
        PasswordRequest: {
            password: string;
        };
        ChangePasswordRequest: {
            currentPassword: string;
            newPassword: string;
        };
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
        TopologyContext: {
            id: string;
            name: string;
            nodes: {
                id: string;
                label: string;
                type: string;
                identity?: {
                    mgmtIp?: string;
                    chassisId?: string;
                    sysName?: string;
                } & {
                    [key: string]: unknown;
                };
            }[];
            edges: {
                id: string;
                from: {
                    nodeId: string;
                    port?: string;
                    portInfo?: {
                        id: string;
                        label?: string;
                        interfaceName?: string;
                        aliases?: string[];
                    };
                };
                to: {
                    nodeId: string;
                    port?: string;
                    portInfo?: {
                        id: string;
                        label?: string;
                        interfaceName?: string;
                        aliases?: string[];
                    };
                };
                standard?: string;
            }[];
            subgraphs?: {
                [key: string]: unknown;
            }[];
            metrics: {
                [key: string]: unknown;
            };
            metricsSourceId?: string;
            mapping?: {
                [key: string]: unknown;
            };
        };
        TopologyGraph: {
            id: string;
            name: string;
            graph: components["schemas"]["NetworkGraph"];
            stale: boolean;
        };
        NetworkGraph: {
            version?: string;
            name?: string;
            nodes: {
                [key: string]: unknown;
            }[];
            links: {
                [key: string]: unknown;
            }[];
            subgraphs?: {
                [key: string]: unknown;
            }[];
            settings?: {
                [key: string]: unknown;
            };
        } & {
            [key: string]: unknown;
        };
        TopologyView: {
            id: string;
            name: string;
            graph: components["schemas"]["NetworkGraph"];
            resolved?: {
                [key: string]: unknown;
            };
            stale: boolean;
        };
        TopologyRender: {
            id: string;
            name: string;
            /** @enum {boolean} */
            hierarchical: false;
            svg: string;
            css: string;
            viewBox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            nodeCount: number;
            edgeCount: number;
        } | {
            id: string;
            name: string;
            /** @enum {boolean} */
            hierarchical: true;
            sheets: {
                [key: string]: {
                    svg: string;
                    css: string;
                    viewBox: {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                    };
                    label: string;
                    parentId: string | null;
                };
            };
            rootSheetId: string;
            nodeCount: number;
            edgeCount: number;
        };
        PublicDashboard: {
            id: string;
            name: string;
            layoutJson: string;
        };
        PublicTopologyMetadata: {
            id: string;
            name: string;
            mappingJson?: string;
        };
        PublicAlert: {
            id: string;
            /** @enum {string} */
            severity: "critical" | "high" | "medium" | "low" | "info" | "ok";
            /** @enum {string} */
            status: "active" | "resolved";
            title: string;
            host?: string;
            nodeId?: string;
            startTime: number;
            endTime?: number;
        };
        DataSourcePluginList: components["schemas"]["DataSourcePlugin"][];
        DataSourcePlugin: {
            type: string;
            displayName: string;
            capabilities: string[];
            configSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
            optionsSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
        };
        PluginConfigProperty: {
            /** @enum {string} */
            type: "string" | "number" | "boolean" | "object" | "array";
            title?: string;
            description?: string;
            /** @enum {string} */
            format?: "password" | "uri" | "email";
            secret?: boolean;
            placeholder?: string;
            default?: unknown;
            oneOf?: {
                const: string | number;
                title: string;
            }[];
            enum?: (string | number)[];
            minimum?: number;
            maximum?: number;
            step?: number;
            items?: {
                /** @enum {string} */
                type: "string";
            };
            optionsSource?: string;
            freeSolo?: boolean;
            scope?: {
                /** @enum {string} */
                kind: "include" | "exclude";
                key: string;
            };
            properties?: {
                [key: string]: components["schemas"]["PluginConfigProperty"];
            };
            required?: string[];
            visibleWhen?: {
                field: string;
                equals: string | number | boolean;
            };
            requiredWhen?: {
                field: string;
                equals: string | number | boolean;
            };
            warning?: string;
            help?: string;
            docUrl?: string;
            serverSupplied?: boolean;
        };
        DataSourceList: components["schemas"]["DataSource"][];
        DataSource: {
            id: string;
            name: string;
            type: string;
            configJson: string;
            /** @enum {string} */
            status: "connected" | "disconnected" | "unknown";
            statusMessage?: string;
            lastCheckedAt?: number;
            failCount: number;
            createdAt: number;
            updatedAt: number;
        };
        ConfigOptionsResult: {
            options: {
                value: string;
                label: string;
            }[];
        };
        ConnectionInfoResult: {
            items: {
                label: string;
                value: string;
                copyable?: boolean;
            }[];
        };
        AttachedTopologyList: {
            topologyId: string;
            name: string;
        }[];
        ConnectionResult: {
            success: boolean;
            message: string;
            version?: string;
            warnings?: string[];
        };
        HostList: components["schemas"]["Host"][];
        Host: {
            id: string;
            name: string;
            displayName?: string;
            /** @enum {string} */
            status?: "up" | "down" | "unknown";
            ip?: string;
            identity?: {
                mgmtIp?: string;
                chassisId?: string;
                sysName?: string;
                ifIndex?: number;
                ifName?: string;
                mac?: string;
                vendorIds?: {
                    [key: string]: string;
                };
            };
        };
        HostItemList: components["schemas"]["HostItem"][];
        HostItem: {
            id: string;
            hostId: string;
            name: string;
            key: string;
            lastValue?: string;
            unit?: string;
            interfaceName?: string;
            interfaceIdentity?: {
                mgmtIp?: string;
                chassisId?: string;
                sysName?: string;
                ifIndex?: number;
                ifName?: string;
                mac?: string;
                vendorIds?: {
                    [key: string]: string;
                };
            };
            /** @enum {string} */
            direction?: "in" | "out";
        };
        InterfaceNeighborList: components["schemas"]["InterfaceNeighbor"][];
        InterfaceNeighbor: {
            localInterface: string;
            localInterfaceIdentity?: {
                mgmtIp?: string;
                chassisId?: string;
                sysName?: string;
                ifIndex?: number;
                ifName?: string;
                mac?: string;
                vendorIds?: {
                    [key: string]: string;
                };
            };
            remoteSysName?: string;
            remoteChassisId?: string;
            remotePortId?: string;
        };
        DiscoveredMetricList: components["schemas"]["DiscoveredMetric"][];
        DiscoveredMetric: {
            name: string;
            labels: {
                [key: string]: string;
            };
            value: number | string | boolean;
            help?: string;
        };
        FilterOptions: {
            sites: {
                slug: string;
                name: string;
            }[];
            tags: {
                slug: string;
                name: string;
            }[];
        };
        AlertList: components["schemas"]["Alert"][];
        Alert: {
            id: string;
            /** @enum {string} */
            severity: "critical" | "high" | "medium" | "low" | "info" | "ok";
            title: string;
            description?: string;
            host?: string;
            hostId?: string;
            nodeId?: string;
            startTime: number;
            endTime?: number;
            /** @enum {string} */
            status: "active" | "resolved";
            source: string;
            receivedAt?: number;
            url?: string;
            labels?: {
                [key: string]: string;
            };
        };
        NativeApiResult: {
            result?: unknown;
        };
        NativeApiRequest: {
            method: string;
            /** @default {} */
            params: {
                [key: string]: unknown;
            };
        };
        DataSourceScanResult: {
            snapshot: components["schemas"]["Snapshot"];
            observation?: components["schemas"]["TopologyObservation"];
        };
        Snapshot: {
            /** @enum {string} */
            status: "ok" | "partial" | "failed" | "empty";
            statusMessage?: string;
            capturedAt: number;
            graph: {
                [key: string]: unknown;
            } | null;
            warnings?: string[];
        };
        TopologyObservation: {
            id: string;
            topologyId: string;
            sourceId: string;
            capturedAt: number;
            /** @enum {string} */
            status: "ok" | "partial" | "failed" | "empty";
            statusMessage?: string;
            graph: {
                [key: string]: unknown;
            } | null;
            nodeCount: number;
            linkCount: number;
            portCount: number;
            createdAt: number;
            contributionChanged?: boolean;
        };
        DataSourceScanRequest: {
            topologyId?: string;
            seeds?: string[];
        };
        DashboardList: components["schemas"]["Dashboard"][];
        Dashboard: {
            id: string;
            name: string;
            layoutJson: string;
            shareToken?: string;
            createdAt: number;
            updatedAt: number;
        };
        CreateDashboard: {
            name: string;
            layoutJson?: string;
        };
        UpdateDashboard: {
            name?: string;
            layoutJson?: string;
        };
        DashboardShareResult: {
            shareToken: string;
        };
        Success: {
            /** @enum {boolean} */
            success: true;
        };
        Settings: {
            [key: string]: string;
        };
        Setting: {
            key: string;
            value: string;
        };
        SettingsSuccess: {
            /** @enum {boolean} */
            success: true;
        };
        SettingValue: {
            value: string;
        };
        PluginList: components["schemas"]["PluginInfo"][];
        PluginInfo: {
            id: string;
            name: string;
            version: string;
            path: string;
            capabilities: string[];
            configSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
            optionsSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
            enabled: boolean;
            bundled: boolean;
            error?: string;
        };
        PluginManifest: {
            id: string;
            name: string;
            version: string;
            description?: string;
            capabilities: string[];
            entry?: string;
            configSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
            optionsSchema?: {
                /** @enum {string} */
                type: "object";
                required?: string[];
                properties: {
                    [key: string]: components["schemas"]["PluginConfigProperty"];
                };
            };
        };
        InstallPlugin: {
            path?: string;
            /** Format: uri */
            url?: string;
            subdirectory?: string;
        };
        PluginSuccess: {
            /** @enum {boolean} */
            success: true;
        };
        SetPluginEnabled: {
            enabled: boolean;
        };
        ReloadPluginsResult: {
            /** @enum {boolean} */
            success: true;
            plugins: components["schemas"]["PluginList"];
            count: number;
        };
        CreateDataSource: {
            name: string;
            type: string;
            configJson: string;
        };
        UpdateDataSource: {
            name?: string;
            type?: string;
            configJson?: string;
        };
        DeleteDataSourceResult: {
            /** @enum {boolean} */
            success: true;
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
        LatestTopologySnapshot: {
            graph: components["schemas"]["NetworkGraph"] & (Record<string, never> | null);
            capturedAt: number | null;
            /** @enum {string} */
            status?: "ok" | "partial" | "failed" | "empty";
            observationId?: string;
        };
        ResolvedTopology: {
            graph: components["schemas"]["NetworkGraph"];
            snapshotCount: number;
        };
        TopologyDisplaySettings: {
            /** @enum {string} */
            edgeStyle: "polyline" | "orthogonal" | "splines" | "straight";
            /** @enum {string} */
            splineMode: "sloppy" | "conservative" | "conservative_soft";
            hideDisconnected: boolean;
        };
        OkResult: {
            /** @enum {boolean} */
            ok: true;
        };
        UpdateTopologyDisplaySettings: {
            /** @enum {string} */
            edgeStyle?: "polyline" | "orthogonal" | "splines" | "straight";
            /** @enum {string} */
            splineMode?: "sloppy" | "conservative" | "conservative_soft";
            hideDisconnected?: boolean;
        };
        MetricsMapping: {
            nodes: {
                [key: string]: {
                    hostId?: string;
                    hostName?: string;
                };
            };
            links: {
                [key: string]: {
                    monitoredNodeId?: string;
                    interface?: string;
                    bandwidth?: number;
                };
            };
        };
        MappingSuccess: {
            /** @enum {boolean} */
            success: true;
        };
        ParsedTopology: {
            id: string;
            name: string;
            graph: components["schemas"]["NetworkGraph"];
            layout: {
                nodes: {
                    [key: string]: {
                        x: number;
                        y: number;
                    };
                };
                bounds: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                };
            };
            metrics: {
                [key: string]: unknown;
            };
            metricsSourceId?: string;
            mapping?: {
                [key: string]: unknown;
            };
            stale: boolean;
        };
        TopologyDeriving: {
            /** @enum {boolean} */
            deriving: true;
        };
        TopologyComposition: {
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
            /** @enum {string} */
            compositionMode: "additive" | "enrichment";
        };
        TopologyDataSource: {
            id: string;
            topologyId: string;
            dataSourceId: string;
            /** @enum {string} */
            purpose: "topology" | "metrics";
            /** @enum {string} */
            syncMode: "manual" | "on_view" | "webhook";
            webhookSecret?: string;
            lastSyncedAt?: number;
            priority: number;
            optionsJson?: string;
            /** @enum {string} */
            nodeContribution: "scoop" | "anchor";
            /** @enum {string} */
            linkContribution: "add" | "update";
            createdAt: number;
            updatedAt: number;
            dataSource?: components["schemas"]["DataSource"];
        };
        AddTopologySource: {
            dataSourceId: string;
            /** @enum {string} */
            purpose: "topology" | "metrics";
            /** @enum {string} */
            syncMode?: "manual" | "on_view" | "webhook";
            priority?: number;
            optionsJson?: string;
            /** @enum {string} */
            nodeContribution?: "scoop" | "anchor";
            /** @enum {string} */
            linkContribution?: "add" | "update";
        } | {
            /** @enum {string} */
            type: "manual";
            /**
             * @default topology
             * @enum {string}
             */
            purpose: "topology" | "metrics";
        };
        UpdateTopologySource: {
            /** @enum {string} */
            syncMode?: "manual" | "on_view" | "webhook";
            priority?: number;
            optionsJson?: string;
            /** @enum {string} */
            nodeContribution?: "scoop" | "anchor";
            /** @enum {string} */
            linkContribution?: "add" | "update";
        };
        TopologySourceSuccess: {
            /** @enum {boolean} */
            success: true;
        };
        SyncTopologySourceResult: {
            observation: components["schemas"]["TopologyObservation"];
            snapshot: {
                /** @enum {string} */
                status: "ok" | "partial" | "failed" | "empty";
                statusMessage?: string;
                capturedAt: number;
                warnings?: string[];
                graph: components["schemas"]["NetworkGraph"] & (Record<string, never> | null);
            };
        };
        StartedTopologySyncJobResult: {
            job: components["schemas"]["TopologySyncJob"];
        };
        TopologySyncJob: {
            id: string;
            topologyId: string;
            /** @enum {string} */
            state: "running" | "done" | "failed" | "cancelled";
            startedAt: number;
            finishedAt?: number;
            steps: {
                key: string;
                label: string;
                /** @enum {string} */
                status: "pending" | "running" | "done" | "failed" | "skipped";
                message?: string;
                nodeCount?: number;
                linkCount?: number;
                stage?: string;
            }[];
            cancelRequested: boolean;
        };
        TopologySyncJobResult: {
            job: components["schemas"]["TopologySyncJob"] & (Record<string, never> | null);
        };
        ShareTopologyResult: {
            shareToken: string;
        };
        UnshareTopologyResult: {
            /** @enum {boolean} */
            success: true;
        };
        DiscoveryPolicy: {
            topologyDefault: null;
            runtimeDefault: {
                /** @enum {string} */
                mode: "auto" | "observe" | "disabled";
                intervalMs: number;
            };
            nodes: {
                [key: string]: {
                    /** @enum {string} */
                    mode: "auto" | "observe" | "disabled";
                    intervalMs: number;
                    community?: string;
                    source: {
                        /** @enum {string} */
                        mode: "node" | "subgraph" | "topology" | "default";
                        /** @enum {string} */
                        intervalMs: "node" | "subgraph" | "topology" | "default";
                        /** @enum {string} */
                        community: "node" | "subgraph" | "topology" | "default";
                    };
                };
            };
            configs: {
                [key: string]: ({
                    /** @enum {string} */
                    kind: "access";
                    /** @enum {string} */
                    protocol: "snmp";
                    community?: string;
                } | {
                    /** @enum {string} */
                    kind: "policy";
                    /** @enum {string} */
                    mode?: "auto" | "observe" | "disabled";
                    intervalMs?: number;
                })[];
            };
            subgraphs: {
                [key: string]: ({
                    /** @enum {string} */
                    kind: "access";
                    /** @enum {string} */
                    protocol: "snmp";
                    community?: string;
                } | {
                    /** @enum {string} */
                    kind: "policy";
                    /** @enum {string} */
                    mode?: "auto" | "observe" | "disabled";
                    intervalMs?: number;
                })[];
            };
        };
        WebhookResult: {
            /** @enum {boolean} */
            success: true;
            topologyId: string;
            nodeCount: number;
            linkCount: number;
        } | {
            /** @enum {boolean} */
            success: true;
            alertCount: number;
        };
        WebhookHealth: {
            /** @enum {string} */
            status: "ok";
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
                total: number;
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
