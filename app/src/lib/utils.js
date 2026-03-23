const BRAND_DEFINITIONS = [
  { key: "abb", match: ["abb"], label: "ABB", logo: "/brands/abb.png" },
  { key: "fanuc", match: ["fanuc"], label: "FANUC", logo: "/brands/fanuc.png" },
  { key: "omron", match: ["omron"], label: "Omron", logo: "/brands/omron.png" },
  { key: "allen-bradley", match: ["rockwell", "allen"], label: "Allen-Bradley", logo: "/brands/allen-bradley.png" },
  { key: "yaskawa", match: ["yaskawa"], label: "Yaskawa", logo: "/brands/yaskawa.png" },
  { key: "danfoss", match: ["danfoss"], label: "Danfoss", logo: "/brands/danfoss.png" },
  { key: "haas", match: ["haas"], label: "Haas", logo: "/brands/haas.png" },
  { key: "lenze", match: ["lenze"], label: "Lenze", logo: "/brands/lenze.png" },
  { key: "bosch-rexroth", match: ["bosch", "rexroth"], label: "Bosch Rexroth", logo: "/brands/bosch-rexroth.png" },
  { key: "mitsubishi", match: ["mitsubishi"], label: "Mitsubishi", logo: "/brands/mitsubishi.png" },
  { key: "schneider", match: ["schneider"], label: "Schneider Electric", logo: "/brands/schneider.png" },
  { key: "siemens", match: ["siemens"], label: "Siemens", logo: "/brands/siemens.png" },
  { key: "fagor", match: ["fagor"], label: "Fagor", logo: "/brands/fagor.png" },
  { key: "weg", match: ["weg"], label: "WEG", logo: "/brands/weg.png" },
];

const normalizeBrandText = (brand) => (brand || "").trim().toLowerCase();

const findBrandDefinition = (brand) => {
  const normalizedBrand = normalizeBrandText(brand);
  if (!normalizedBrand) return null;

  return BRAND_DEFINITIONS.find(({ match }) => match.some(term => normalizedBrand.includes(term))) || null;
};

export const getBrandMeta = (brand) => {
  const normalizedBrand = normalizeBrandText(brand);
  if (!normalizedBrand) {
    return { key: "unknown", label: "", logo: null };
  }

  const definition = findBrandDefinition(brand);
  if (definition) {
    return {
      key: definition.key,
      label: definition.label,
      logo: definition.logo,
    };
  }

  return {
    key: normalizedBrand,
    label: brand.trim(),
    logo: null,
  };
};

export const getBrandLogo = (brand) => getBrandMeta(brand).logo;
