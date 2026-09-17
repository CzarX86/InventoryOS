import {
  approveAccessRequest,
  listAccessUsers,
  revokeAccess,
  subscribeToNotifications,
} from "./accessControl";

const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);
const mockOnSnapshot = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
  functions: {},
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db, name) => ({ db, name })),
  doc: jest.fn((db, name, id) => ({ db, name, id })),
  limit: jest.fn((value) => ({ limit: value })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn((...args) => ({ args })),
  updateDoc: jest.fn(),
  where: jest.fn((field, operator, value) => ({ field, operator, value })),
}));

describe("access control client gateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCallable.mockResolvedValue({ data: { users: [], ownerExcluded: true } });
  });

  it("keeps approval mutations behind named callable functions", async () => {
    await approveAccessRequest("user-1");
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, "approveAccessRequest");
    expect(mockCallable).toHaveBeenCalledWith({ targetUid: "user-1" });

    await revokeAccess("user-1");
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, "revokeAccess");
    expect(mockCallable).toHaveBeenCalledWith({ targetUid: "user-1" });
  });

  it("loads the server-sanitized user list without exposing the config document", async () => {
    await listAccessUsers("pending");
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, "listAccessUsers");
    expect(mockCallable).toHaveBeenCalledWith({ status: "pending" });
  });

  it("subscribes only to notifications addressed to the current user", () => {
    const onChange = jest.fn();
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockImplementation((_query, callback) => {
      callback({
        docs: [{
          id: "notification-1",
          data: () => ({
            type: "access_request",
            title: "Novo pedido",
            body: "Aprovação pendente",
            recipientUserId: "admin-1",
          }),
        }],
      });
      return unsubscribe;
    });

    expect(subscribeToNotifications("admin-1", onChange)).toBe(unsubscribe);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "notification-1" })]);
  });
});
