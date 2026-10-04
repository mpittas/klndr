/**
 * The measurements of the day timeline that are about drawing it (the minutes-and-pixels maths is in
 * `@klndr/core`, shared with the web). Points, like every size in the app.
 */

/** The hour gutter on the left, wide enough for the live "12:00 PM" pill. */
export const GUTTER_WIDTH = 56;

/** Space above midnight, so the first hour label is not cut off; the grid itself starts below it. */
export const GRID_TOP = 12;

/** A block is drawn this fraction of the timeline's width inside the edges of its column (the web's 1%). */
export const BLOCK_SIDE_INSET = 0.01;

/** Room under midnight, so the last block clears the add button and the tab bar. */
export const BOTTOM_PADDING = 104;

/** A block narrower than this (several side by side) drops its completion ring and its time, as on the web. */
export const WIDE_BLOCK = 128;
/** A one-line block shows its time beside the title only when it is at least this wide. */
export const VERY_WIDE_BLOCK = 240;

/** The completion ring: how big it is drawn, and the square around it that counts as a tap on it. */
export const RING_SIZE = 16;
export const RING_HIT = 36;

/** The strip along a block's bottom edge that resizes it. */
export const RESIZE_STRIP = 22;
