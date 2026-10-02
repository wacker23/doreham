/** Korean business registration number (사업자등록번호): 10 digits with a checksum. Client- and server-safe. */
export function validateBusinessNumber(brn: string): boolean {
  const digits = brn.replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  sum += Math.floor((parseInt(digits[8], 10) * 5) / 10);

  const checksum = (10 - (sum % 10)) % 10;

  return checksum === parseInt(digits[9], 10);
}
