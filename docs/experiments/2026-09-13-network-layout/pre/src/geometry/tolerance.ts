/** Default absolute tolerance for coordinate comparisons, in drawing units (px). */
export const GEOMETRY_EPSILON = 1e-6

/** How close an endpoint must be to a node outline to be attributed to one of its sides. */
export const BOUNDARY_TOLERANCE = 1e-5

/** Visible gap at or below which two outlines count as touching. */
export const CONTACT_TOLERANCE = 1e-5

/** Consecutive points closer than this are merged after row-level visibility routing. */
export const ROUTE_POINT_MERGE_TOLERANCE = 1e-7
