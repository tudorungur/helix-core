// Official Romanian checksum algorithms — catch typos, not just malformed length/format.

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

export function validateCNP(rawCnp: string): boolean {
  const cnp = rawCnp.trim();
  if (!/^\d{13}$/.test(cnp)) return false;

  const digits = cnp.split("").map(Number);
  const sum = CNP_WEIGHTS.reduce((total, weight, i) => total + weight * digits[i], 0);
  const control = sum % 11 === 10 ? 1 : sum % 11;

  return control === digits[12];
}

const CUI_WEIGHTS = [7, 5, 3, 2, 1, 7, 5, 3, 2];

export function validateCUI(rawCui: string): boolean {
  const cui = rawCui.trim().replace(/^RO/i, "");
  if (!/^\d{2,10}$/.test(cui)) return false;

  const controlDigit = Number(cui[cui.length - 1]);
  const base = cui.slice(0, -1).padStart(9, "0");
  const digits = base.split("").map(Number);
  const sum = CUI_WEIGHTS.reduce((total, weight, i) => total + weight * digits[i], 0);
  const control = ((sum * 10) % 11) % 10;

  return control === controlDigit;
}
