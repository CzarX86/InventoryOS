export function normalizePhoneDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

export function filterCompanySuggestions(companies = [], value = "") {
  const term = String(value).trim().toLocaleLowerCase("pt-BR");
  if (term.length < 2) return [];

  return companies
    .filter((company) => String(company?.name || "").toLocaleLowerCase("pt-BR").includes(term))
    .sort((left, right) => {
      const leftName = String(left?.name || "").toLocaleLowerCase("pt-BR");
      const rightName = String(right?.name || "").toLocaleLowerCase("pt-BR");
      return Number(!leftName.startsWith(term)) - Number(!rightName.startsWith(term))
        || leftName.localeCompare(rightName, "pt-BR");
    })
    .slice(0, 6);
}
