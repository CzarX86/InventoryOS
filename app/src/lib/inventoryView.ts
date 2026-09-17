export type InventoryGroupBy = "none" | "brand" | "type";

export type InventoryViewItem = {
  id?: string | number;
  model?: string | null;
  brand?: string | null;
  type?: string | null;
  partNumber?: string | null;
  serialNumber?: string | null;
};

export type InventoryGroup<TItem extends InventoryViewItem = InventoryViewItem> = {
  id: string;
  label: string;
  items: TItem[];
};

export type InventorySearchOption = {
  value: string;
  label: string;
  description: string;
};

function textValue(value: unknown) {
  return String(value || "").trim();
}

function normalizedValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function buildInventoryGroups<TItem extends InventoryViewItem>(items: TItem[], groupBy: InventoryGroupBy) {
  if (groupBy === "none") return [] as InventoryGroup<TItem>[];

  const groups = new Map<string, InventoryGroup<TItem>>();
  const fallback = groupBy === "brand" ? "Sem marca" : "Geral";

  items.forEach((item) => {
    const label = textValue(item[groupBy]) || fallback;
    const key = normalizedValue(label);
    const groupId = `${groupBy}:${key}`;
    const group = groups.get(groupId);

    if (group) {
      group.items.push(item);
      return;
    }

    groups.set(groupId, { id: groupId, label, items: [item] });
  });

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
}

export function buildInventorySearchOptions(items: InventoryViewItem[]) {
  const options: InventorySearchOption[] = [];
  const seen = new Set<string>();

  const addOption = (value: unknown, description: string) => {
    const label = textValue(value);
    const key = normalizedValue(label);
    if (!label || seen.has(key)) return;
    seen.add(key);
    options.push({ value: label, label, description });
  };

  items.forEach((item) => {
    const model = textValue(item.model);
    const brand = textValue(item.brand);
    const type = textValue(item.type);
    const modelContext = [brand, type].filter(Boolean).join(" · ") || "Modelo";
    addOption(model, modelContext);
  });

  items.forEach((item) => addOption(item.brand, "Marca"));
  items.forEach((item) => {
    const itemContext = [textValue(item.model), textValue(item.brand)].filter(Boolean).join(" · ") || "Código do item";
    addOption(item.partNumber, itemContext);
    addOption(item.serialNumber, itemContext);
  });
  items.forEach((item) => addOption(item.type, "Tipo de equipamento"));

  return options;
}
