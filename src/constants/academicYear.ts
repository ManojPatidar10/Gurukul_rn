const CURRENT_YEAR = new Date().getFullYear();

export const ACADEMIC_YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const start = CURRENT_YEAR - 1 + i;
  const label = `${start}-${start + 1}`;
  return { label, value: label };
});
