import { renderHook, waitFor } from "@testing-library/react";
import useFeatureFlags from "./useFeatureFlags";

const mockDoc = jest.fn((db, collectionName, id) => ({ collectionName, id }));
const mockOnSnapshot = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

describe("useFeatureFlags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns default flags when there is no authenticated user", () => {
    const { result } = renderHook(() => useFeatureFlags(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.enabledCount).toBe(1);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes to the system feature_flags document and normalizes data", async () => {
    mockOnSnapshot.mockImplementation((ref, onNext) => {
      onNext({
        data: () => ({
          contactReviewQueue: true,
          whatsappIngestion: "true",
          supplierRfq: 1,
        }),
      });

      return jest.fn();
    });

    const { result } = renderHook(() => useFeatureFlags({ uid: "user-1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockDoc).toHaveBeenCalledWith({}, "system", "feature_flags");
    expect(result.current.flags.contactReviewQueue).toBe(true);
    expect(result.current.flags.whatsappIngestion).toBe(true);
    expect(result.current.flags.supplierRfq).toBe(true);
    expect(result.current.flags.actionInbox).toBe(false);
    expect(result.current.enabledCount).toBe(3);
  });
});

