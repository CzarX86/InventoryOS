import { renderHook, waitFor } from "@testing-library/react";
import useAuth from "./useAuth";

const mockSetDoc = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockOnSnapshot = jest.fn();
const mockInitializeAccessProfile = jest.fn();

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
  onSnapshot: (...args) => mockOnSnapshot(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

jest.mock("@/lib/accessControl", () => ({
  initializeAccessProfile: (...args) => mockInitializeAccessProfile(...args),
}));

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps a newly registered user pending until an admin approves access", async () => {
    const profile = {
      uid: "user-123",
      email: "owner@example.com",
      ownerId: "user-123",
      defaultAccountId: "workspace-1",
      workspaceId: "workspace-1",
      accessStatus: "pending",
      role: "user",
      isHiddenOwner: false,
    };
    mockInitializeAccessProfile.mockResolvedValue(profile);
    mockOnSnapshot.mockImplementation((reference, callback) => {
      callback({
        exists: () => true,
        data: () => profile,
      });
      return jest.fn();
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

    expect(mockInitializeAccessProfile).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();

    expect(result.current.user.ownerId).toBe("user-123");
    expect(result.current.user.defaultAccountId).toBe("workspace-1");
    expect(result.current.isApproved).toBe(false);
    expect(result.current.accessStatus).toBe("pending");
  });
});
