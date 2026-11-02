// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Every size the kit draws with, derived from two base quantities. Nothing else in the kit
 * names a length: change `em` and the whole drawing scales; change `stroke` and only the lines
 * get heavier. The layout never reads these directly: it asks `measure.ts` for the size of
 * each part and is handed back positions.
 */

/** The two quantities everything else is a ratio of. */
export interface Base {
  /** The body font size; every length that is not a line is a multiple of it. */
  em: number
  /** The base line width; every line is a multiple of it. */
  stroke: number
}

export const DEFAULT_BASE: Base = { em: 11, stroke: 1 }

/** Spacing steps, in em. */
const STEP = { hair: 0.25, tight: 0.5, snug: 0.75, base: 1, loose: 1.5, wide: 2 } as const

/** Font sizes, in em. */
const TYPE = { title: 1.25, body: 1, small: 0.9, caption: 0.8 } as const

/** Line widths, in stroke. */
const LINE = { hair: 0.5, thin: 1, base: 1.5, bold: 2, heavy: 3 } as const

/** Larger sizes that are not spacing steps, in em. */
const SIZE = {
  margin: 4,
  icon: 2.5,
  minWidth: 7,
  minHeight: 5.5,
  minSlot: 3.5,
  labelBand: 2.5,
  labelOffset: 1.25,
  notch: 3,
  dot: 0.1,
} as const

/** Spacing the layout keeps between parts, in em. */
const SPACE = { gap: 3, memberGap: 2, groupGap: 4 } as const

/** Width of a character as a share of its font size: one for ASCII, one for full-width. */
const GLYPH = { ascii: 0.6, wide: 1 } as const

/** Height of a line of text as a share of its font size. */
const LEADING = 1.5
/** Height of a tight label box (one short line in a chip) as a share of its font size. */
const LEADING_TIGHT = 1.25
/** How far below a line's centre its baseline sits, as a share of the font size. */
const BASELINE = 0.35
/** Letter spacing of upper-case labels, in em of the text. */
const TRACKING = 0.05

/** Opacities are shares, not lengths. */
const OPACITY = { wash: 0.08, line: 0.25, shadow: 0.06 } as const

/** Font weights, named; they are not lengths. */
export const FONT_WEIGHT = { regular: 400, strong: 600, bold: 700 } as const

/** Text as the kit draws it. Each role is one CSS class (see `styles.ts`). */
export type TextRole =
  | 'nodeTitle'
  | 'nodeText'
  | 'badge'
  | 'portLabel'
  | 'groupLabel'
  | 'linkCaption'
  | 'hullLabel'

const ROLE_TYPE: Record<TextRole, keyof typeof TYPE> = {
  nodeTitle: 'title',
  nodeText: 'small',
  badge: 'caption',
  portLabel: 'caption',
  groupLabel: 'body',
  linkCaption: 'small',
  hullLabel: 'caption',
}

export interface Tokens {
  em: number
  stroke: number
  line: Record<keyof typeof LINE, number>
  /** `shift` moves a baseline down from the middle of its line. */
  text: Record<TextRole, { fontSize: number; shift: number }>
  glyph: { ascii: number; wide: number }
  tracking: number
  /** Share of opacity for washes, quiet lines and the node shadow. */
  opacity: Record<keyof typeof OPACITY, number>
  /** Air around the drawing so strokes and port labels at its edge are not cut. */
  margin: number
  /** Node shadow offset and blur. */
  shadow: { dy: number; blur: number }
  card: {
    padding: number
    iconSize: number
    iconGap: number
    rowHeight: number
    sectionGap: number
    /** Floors so very short labels do not collapse. */
    minWidth: number
    minHeight: number
    badgeGap: number
    badgeHeight: number
    badgePadding: number
    badgeRadius: number
    factGap: number
    cornerRadius: number
  }
  port: {
    /** Side of the square marker. */
    size: number
    cornerRadius: number
    /** Minimum centre-to-centre spacing between adjacent ports on one side. */
    minSlot: number
    /** Air between two adjacent port-label boxes. */
    labelGap: number
    labelHeight: number
    /** Room a label box adds to its text, in total. */
    labelPadding: number
    labelCornerRadius: number
    /** Distance from the port centre to the nearest edge of its label. */
    labelOffset: number
  }
  /** The space the layout keeps: between cards, inside a redundancy set, between groups. */
  space: {
    gap: number
    memberGap: number
    groupGap: number
    /** The white between two lines that part somewhere, and between a line and a card: one em. */
    apart: number
    /** How far a wire leaves a card straight before it may turn: the label's band, then the white of a line off another row. */
    leadOut: number
  }
  caption: { lineHeight: number; paddingX: number; paddingY: number; cornerRadius: number }
  group: {
    padding: number
    /** Band above the contents that holds the label. */
    labelBand: number
    /** Label inset from the frame's left edge. */
    labelX: number
    cornerRadius: number
  }
  wire: {
    /** How far a bend is rounded off. */
    cornerRadius: number
    /** Dash and gap lengths as multiples of the line's own stroke, so a thick line keeps the look of a thin one. */
    dashed: readonly [number, number]
    dotted: readonly [number, number]
  }
  hull: {
    pad: number
    outerRadius: number
    notchHeight: number
    /** Below this a seam is too narrow for the glasses shape to read. */
    notchMin: number
    filletRadius: number
    /** Label offset from the hull's top-left corner. */
    labelX: number
    labelY: number
  }
}

/** Fill in what the caller left out of a base. */
export function resolveBase(base: Partial<Base> = {}): Base {
  return { ...DEFAULT_BASE, ...base }
}

/** All the kit's sizes for a base. */
export function resolveTokens(partial: Partial<Base> = {}): Tokens {
  const { em, stroke } = resolveBase(partial)
  const step = (n: keyof typeof STEP) => STEP[n] * em
  const type = (n: keyof typeof TYPE) => TYPE[n] * em
  const text = Object.fromEntries(
    Object.entries(ROLE_TYPE).map(([role, size]) => [
      role,
      { fontSize: type(size), shift: type(size) * BASELINE },
    ]),
  ) as Tokens['text']
  const rowHeight = LEADING * em
  const labelHeight = LEADING_TIGHT * text.portLabel.fontSize
  const labelOffset = SIZE.labelOffset * em
  return {
    em,
    stroke,
    line: {
      hair: LINE.hair * stroke,
      thin: LINE.thin * stroke,
      base: LINE.base * stroke,
      bold: LINE.bold * stroke,
      heavy: LINE.heavy * stroke,
    },
    text,
    glyph: GLYPH,
    tracking: TRACKING,
    opacity: OPACITY,
    margin: SIZE.margin * em,
    shadow: { dy: LINE.thin * stroke, blur: LINE.thin * stroke },
    card: {
      padding: step('loose'),
      iconSize: SIZE.icon * em,
      iconGap: step('base'),
      rowHeight,
      sectionGap: step('base'),
      minWidth: SIZE.minWidth * em,
      minHeight: SIZE.minHeight * em,
      badgeGap: step('snug'),
      badgeHeight: rowHeight,
      badgePadding: step('tight'),
      badgeRadius: step('hair'),
      factGap: step('base'),
      cornerRadius: step('snug'),
    },
    port: {
      size: step('snug'),
      cornerRadius: step('hair'),
      minSlot: SIZE.minSlot * em,
      labelGap: step('base'),
      labelHeight,
      labelPadding: step('tight'),
      labelCornerRadius: step('hair'),
      labelOffset,
    },
    space: {
      gap: SPACE.gap * em,
      memberGap: SPACE.memberGap * em,
      groupGap: SPACE.groupGap * em,
      apart: em,
      leadOut: labelOffset + labelHeight / 2 + em,
    },
    caption: {
      lineHeight: LEADING * text.linkCaption.fontSize,
      paddingX: step('snug'),
      paddingY: step('tight'),
      cornerRadius: step('tight'),
    },
    group: {
      padding: step('wide'),
      labelBand: SIZE.labelBand * em,
      labelX: step('base'),
      cornerRadius: step('base'),
    },
    wire: {
      cornerRadius: step('tight'),
      dashed: [step('tight') / stroke, step('hair') / stroke],
      dotted: [(SIZE.dot * em) / stroke, step('tight') / stroke],
    },
    hull: {
      pad: step('base'),
      outerRadius: step('wide'),
      notchHeight: SIZE.notch * em,
      notchMin: step('snug'),
      filletRadius: step('snug'),
      labelX: step('hair'),
      labelY: step('tight'),
    },
  }
}
