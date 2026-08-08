/**
 * Validated data-viz palette (see dataviz skill: references/palette.md).
 * Categorical order is fixed — never cycle or reassign per-filter.
 * Status roles are fixed constants, never themed, never reused for series.
 */
export const CATEGORICAL_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

export const STATUS_PALETTE = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export const SINGLE_SERIES_COLOR = CATEGORICAL_PALETTE[0];

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  PRESENT: STATUS_PALETTE.good,
  LATE: STATUS_PALETTE.warning,
  HALF_DAY: STATUS_PALETTE.serious,
  ABSENT: STATUS_PALETTE.critical,
};
