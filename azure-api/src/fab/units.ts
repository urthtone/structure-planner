/** Round to the nearest 1/16 inch. */
export const sixteenth = (inches: number) => Math.round(inches * 16) / 16;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** 95.9375 → `95-15/16"`. */
export function inchesText(inches: number): string {
  const total = Math.round(Math.abs(inches) * 16);
  const whole = Math.floor(total / 16);
  const frac = total % 16;
  const sign = inches < 0 && total ? '-' : '';
  if (!frac) return `${sign}${whole}"`;
  const g = gcd(frac, 16);
  return `${sign}${whole ? whole + '-' : ''}${frac / g}/${16 / g}"`;
}

/** 95.9375 → `7' 11-15/16"`. */
export function feetInchesText(inches: number): string {
  const total = Math.round(Math.abs(inches) * 16);
  const feet = Math.floor(total / 192);
  const rest = (total - feet * 192) / 16;
  const sign = inches < 0 && total ? '-' : '';
  if (!feet) return sign + inchesText(rest);
  return `${sign}${feet}' ${inchesText(rest)}`;
}

export const ft = (feet: number) => feet * 12;
export const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
export const deg = (radians: number) => (radians * 180) / Math.PI;
