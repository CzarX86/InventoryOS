export const getBrandLogo = (brand) => {
  if (!brand) return null;
  const b = brand.toLowerCase();
  if (b.includes("abb")) return "/brands/abb.png";
  if (b.includes("fanuc")) return "/brands/fanuc.png";
  if (b.includes("omron")) return "/brands/omron.png";
  if (b.includes("rockwell") || b.includes("allen")) return "/brands/allen-bradley.png";
  if (b.includes("yaskawa")) return "/brands/yaskawa.png";
  if (b.includes("danfoss")) return "/brands/danfoss.png";
  if (b.includes("haas")) return "/brands/haas.png";
  if (b.includes("lenze")) return "/brands/lenze.png";
  if (b.includes("bosch") || b.includes("rexroth")) return "/brands/bosch-rexroth.png";
  if (b.includes("mitsubishi")) return "/brands/mitsubishi.png";
  if (b.includes("schneider")) return "/brands/schneider.png";
  if (b.includes("siemens")) return "/brands/siemens.png";
  if (b.includes("fagor")) return "/brands/fagor.png";
  if (b.includes("weg")) return "/brands/weg.png";
  return null;
};
