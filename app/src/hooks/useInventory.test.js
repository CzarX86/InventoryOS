import { renderHook, act } from "@testing-library/react";
import useInventory from "./useInventory";

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  db: {}
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn((query, callback) => {
    // Determine which test is running or just provide common mock data
    const mockDocs = [
      { id: '1', data: () => ({ partNumber: 'ABC-123', model: 'PowerFlex', brand: 'Allen-Bradley', type: 'Inverter' }) },
      { id: '2', data: () => ({ partNumber: 'XYZ-456', model: 'Sinamics', brand: 'Siemens', type: 'Inverter' }) }
    ];
    callback({ docs: mockDocs });
    return jest.fn(); // unsubscribe
  }),
  query: jest.fn(),
  orderBy: jest.fn()
}));

describe("useInventory", () => {
  const initialItems = [
    { id: 1, model: "CFW500", partNumber: "ABC-123" },
    { id: 2, model: "PowerFlex", partNumber: "XYZ-789" },
  ];

  it("should filter items by part number", () => {
    const { result } = renderHook(() => useInventory(initialItems));
    
    act(() => {
      result.current.setSearchQuery("ABC");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].partNumber).toBe("ABC-123");
  });

  it("should filter items by model", () => {
    const { result } = renderHook(() => useInventory(initialItems));
    
    act(() => {
      result.current.setSearchQuery("power");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].model).toBe("PowerFlex");
  });

  it("should return all items when search query is empty", () => {
    const { result } = renderHook(() => useInventory(initialItems));
    expect(result.current.filteredItems).toHaveLength(2);
  });
});
