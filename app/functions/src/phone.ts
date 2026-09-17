export function normalizePhoneDigits(value: string | number | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  const withoutInternationalPrefix = digits.startsWith("00") ? digits.slice(2) : digits;

  if (!withoutInternationalPrefix) return "";
  if (withoutInternationalPrefix.startsWith("55")) return withoutInternationalPrefix;
  if ([10, 11].includes(withoutInternationalPrefix.length)) return `55${withoutInternationalPrefix}`;
  return withoutInternationalPrefix;
}

export function withoutBrazilCountryCode(value: string) {
  return value.startsWith("55") ? value.slice(2) : value;
}
