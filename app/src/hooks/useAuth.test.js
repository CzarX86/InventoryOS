import { renderHook, waitFor } from "@testing-library/react";
import useAuth from "./useAuth";

const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  googleProvider: {},
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, collectionName, id) => ({ collectionName, id })),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a default ownership boundary when the user profile does not exist", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback({
        uid: "user-123",
        email: "owner@example.com",
      });

      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockSetDoc).toHaveBeenCalledWith(
      { collectionName: "users", id: "user-123" },
      expect.objectContaining({
        email: "owner@example.com",
        ownerId: "user-123",
        defaultAccountId: "acct_user-123",
        role: "user",
      })
    );

    expect(result.current.user.ownerId).toBe("user-123");
    expect(result.current.user.defaultAccountId).toBe("acct_user-123");
  });
});
