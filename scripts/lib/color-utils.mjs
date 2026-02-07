// ============================================================================
// COLOR UTILITIES — WCAG contrast validation for build checklist
// ============================================================================

/**
 * Check if a string is a valid 6-digit hex color.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidHex(str) {
  return /^#[0-9A-Fa-f]{6}$/.test(str);
}

/**
 * Convert hex color to RGB array.
 * @param {string} hex - e.g. "#1A1A2E"
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number} Contrast ratio (1:1 to 21:1)
 */
export function calculateContrast(hex1, hex2) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
