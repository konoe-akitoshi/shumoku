// Layout and rendering constants
// These values are shared between layout engines and renderers to ensure consistency

/** Default icon size in pixels (both width and height for square icons) */
export const DEFAULT_ICON_SIZE = 40

/** Gap between icon and label in pixels */
export const ICON_LABEL_GAP = 8

/** Line height for node labels in pixels */
export const LABEL_LINE_HEIGHT = 16

/** Vertical padding inside node box in pixels */
export const NODE_VERTICAL_PADDING = 16

/** Horizontal padding inside node box in pixels */
export const NODE_HORIZONTAL_PADDING = 16

/** Minimum spacing between ports in pixels (fallback when no labels) */
export const MIN_PORT_SPACING = 32

/** Port label font size in pixels */
export const PORT_LABEL_FONT_SIZE = 9

/** Character width ratio relative to font size (for proportional fonts ~0.55, monospace ~0.6) */
export const CHAR_WIDTH_RATIO = 0.55

/** Padding around port label for spacing calculation */
export const PORT_LABEL_PADDING = 8

/** Maximum icon width as percentage of node width (0.0 - 1.0) */
export const MAX_ICON_WIDTH_RATIO = 0.6

/** Estimated character width for node label width calculation (larger font) */
export const ESTIMATED_CHAR_WIDTH = 7
