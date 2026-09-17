import { buildInventoryGroups, buildInventorySearchOptions } from "./inventoryView";

const items = [
  { id: "1", model: "CFW500", brand: "WEG", type: "Inversor", partNumber: "ABC-1", serialNumber: "SN-1" },
  { id: "2", model: "CFW700", brand: "WEG", type: "Inversor", partNumber: "ABC-2" },
  { id: "3", model: "S7-1200", brand: "Siemens", type: "PLC", partNumber: "XYZ-1" },
];

describe("inventory view helpers", () => {
  it("groups inventory by brand or type and keeps empty grouping disabled", () => {
    expect(buildInventoryGroups(items, "none")).toEqual([]);
    expect(buildInventoryGroups(items, "brand")).toEqual([
      { id: "brand:siemens", label: "Siemens", items: [items[2]] },
      { id: "brand:weg", label: "WEG", items: [items[0], items[1]] },
    ]);
    expect(buildInventoryGroups(items, "type")).toEqual([
      { id: "type:inversor", label: "Inversor", items: [items[0], items[1]] },
      { id: "type:plc", label: "PLC", items: [items[2]] },
    ]);
  });

  it("creates unique suggestions with useful context", () => {
    expect(buildInventorySearchOptions(items)).toEqual([
      { value: "CFW500", label: "CFW500", description: "WEG · Inversor" },
      { value: "CFW700", label: "CFW700", description: "WEG · Inversor" },
      { value: "S7-1200", label: "S7-1200", description: "Siemens · PLC" },
      { value: "WEG", label: "WEG", description: "Marca" },
      { value: "Siemens", label: "Siemens", description: "Marca" },
      { value: "ABC-1", label: "ABC-1", description: "CFW500 · WEG" },
      { value: "SN-1", label: "SN-1", description: "CFW500 · WEG" },
      { value: "ABC-2", label: "ABC-2", description: "CFW700 · WEG" },
      { value: "XYZ-1", label: "XYZ-1", description: "S7-1200 · Siemens" },
      { value: "Inversor", label: "Inversor", description: "Tipo de equipamento" },
      { value: "PLC", label: "PLC", description: "Tipo de equipamento" },
    ]);
  });
});
