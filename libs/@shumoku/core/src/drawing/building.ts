// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A thing while a stage walks its input and it is still growing: its lists can be pushed to. The
 * stage hands it on as the read-only `T` it is, and never touches it again.
 */
export type Building<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? E[] : T[K]
}
