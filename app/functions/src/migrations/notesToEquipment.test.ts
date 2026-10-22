import { parseNoteEquipment } from "./notesToEquipment";

describe("parseNoteEquipment", () => {
  it.each([
    ["DRIVE FANUC", { equipmentType: "DRIVE", brand: "FANUC" }],
    ["IHM ALLEN BRADLEY", { equipmentType: "IHM", brand: "ALLEN BRADLEY" }],
    ["SERVO MOTOR SCHNEIDER", { equipmentType: "SERVO MOTOR", brand: "SCHNEIDER" }],
    ["INVERSOR ALLEN BRADLEY", { equipmentType: "INVERSOR", brand: "ALLEN BRADLEY" }],
    ["CLP SIEMENS", { equipmentType: "CLP", brand: "SIEMENS" }],
    ["INVERSOR SIEMENS", { equipmentType: "INVERSOR", brand: "SIEMENS" }],
    ["INVERSOR WEG", { equipmentType: "INVERSOR", brand: "WEG" }],
    ["MOTOR REDUTOR LENZE", { equipmentType: "MOTOR REDUTOR", brand: "LENZE" }],
    ["SERVO MOTOR WEG", { equipmentType: "SERVO MOTOR", brand: "WEG" }],
  ])("splits type and brand for %s", (description, expected) => {
    expect(parseNoteEquipment(description)).toEqual({ ...expected, model: null });
  });

  it("keeps the full text as type when no brand is present", () => {
    expect(parseNoteEquipment("MODULO PROFIBUS")).toEqual({
      equipmentType: "MODULO PROFIBUS",
      brand: null,
      model: null,
    });
    expect(parseNoteEquipment("COOLER")).toEqual({
      equipmentType: "COOLER",
      brand: null,
      model: null,
    });
  });

  it("normalizes separators in composite descriptions", () => {
    expect(parseNoteEquipment("SERVO MITSUBISHI/CABO/DRIVE HAAS30")).toEqual({
      equipmentType: "SERVO CABO DRIVE HAAS30",
      brand: "MITSUBISHI",
      model: null,
    });
    expect(parseNoteEquipment("MEMBRANA/SENSOR")).toEqual({
      equipmentType: "MEMBRANA SENSOR",
      brand: null,
      model: null,
    });
  });

  it("returns null when nothing usable remains", () => {
    expect(parseNoteEquipment(null)).toBeNull();
    expect(parseNoteEquipment("   ")).toBeNull();
    expect(parseNoteEquipment("WEG")).toBeNull();
  });
});
