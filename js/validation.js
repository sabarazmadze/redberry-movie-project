// Shared validators whose wording comes straight from the brief.
export function validateMobile(raw) {
  const v = String(raw).replace(/\s/g, '');
  if (!v) return 'Mobile number is required';
  if (!v.startsWith('5')) return 'Georgian mobile numbers must start with 5';
  if (!/^\d+$/.test(v)) return 'Please enter a valid Georgian mobile number (9 digits starting with 5)';
  if (v.length !== 9) return 'Mobile number must be exactly 9 digits';
  return '';
}
