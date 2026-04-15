import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminInventory from "@/pages/admin/AdminInventory";
import AdminTransfers from "@/pages/admin/AdminTransfers";
import DoctorRequestTransfer from "@/pages/doctor/DoctorRequestTransfer";
import { SocketContext } from "@/contexts/SocketContext";
import axiosInstance from "@/api/axiosInstance";
import { useAuth } from "@/contexts/AuthContext";

vi.mock("@/api/axiosInstance", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const makeAuthValue = (overrides = {}) => ({
  user: {
    id: "user-1",
    name: "Dr. Test",
    email: "doctor@holoid.test",
    role: "DOCTOR",
    hospital: "h1",
    ...overrides,
  },
});

const createMockSocket = () => {
  const listeners = new Map();

  const socket = {
    on: vi.fn((event, callback) => {
      const callbacks = listeners.get(event) || [];
      callbacks.push(callback);
      listeners.set(event, callbacks);
    }),
    off: vi.fn((event, callback) => {
      const callbacks = listeners.get(event) || [];
      listeners.set(
        event,
        callbacks.filter((fn) => fn !== callback)
      );
    }),
    emit: vi.fn((event, payload) => {
      const callbacks = listeners.get(event) || [];
      callbacks.forEach((cb) => cb(payload));
    }),
  };

  return socket;
};

const renderWithQuery = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    React.createElement(QueryClientProvider, { client: queryClient }, ui)
  );
};

const renderWithSocket = (ui, socket) => {
  return render(
    React.createElement(
      SocketContext.Provider,
      { value: { socket, isConnected: true } },
      ui
    )
  );
};

describe("Hospital frontend-backend handshake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue(makeAuthValue());
  });

  it("Test 1 (The Update): renders a newly created ward after POST /resources and has no Lorem Ipsum", async () => {
    let wardCreated = false;

    axiosInstance.get.mockImplementation(async () => {
      if (!wardCreated) {
        return { data: { data: [] } };
      }

      return {
        data: {
          data: [
            {
              _id: "inv-1",
              region: "South Zone",
              wards: [
                {
                  wardName: "Ward Alpha",
                  beds: [
                    { type: "ICU", status: "Vacant", count: 5 },
                    { type: "ICU", status: "Occupied", count: 0 },
                    { type: "ICU", status: "Maintenance", count: 0 },
                  ],
                },
              ],
            },
          ],
        },
      };
    });

    axiosInstance.post.mockImplementation(async () => {
      wardCreated = true;
      return { data: { success: true } };
    });

    renderWithQuery(React.createElement(AdminInventory));

    await screen.findByRole("button", { name: /add new ward/i });

    fireEvent.click(screen.getByRole("button", { name: /add new ward/i }));

    fireEvent.change(screen.getByPlaceholderText(/ward a - critical care/i), {
      target: { value: "Ward Alpha" },
    });

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    fireEvent.click(screen.getByRole("button", { name: /create ward/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/resources",
        expect.objectContaining({
          hospital: "h1",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Ward Alpha")).toBeInTheDocument();
    });

    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
  });

  it("Test 2 (The Transfer): Doctor request increases Admin Pending Requests by 1", async () => {
    const socket = createMockSocket();

    axiosInstance.get.mockResolvedValue({
      data: {
        data: {
          hospitals: [
            {
              _id: "h1",
              name: "Home Hospital",
              resources: { icuBeds: 5, generalBeds: 10, ventilatorBeds: 3 },
            },
            {
              _id: "h2",
              name: "Target Hospital",
              resources: { icuBeds: 8, generalBeds: 12, ventilatorBeds: 4 },
            },
          ],
        },
      },
    });

    axiosInstance.post.mockResolvedValue({
      data: {
        transfer: {
          _id: "tr-100",
          patientName: "Patient One",
          requiredBedType: "icuBeds",
          requestedBy: { name: "Dr. Test" },
          toHospital: { _id: "h2", name: "Target Hospital" },
        },
      },
    });

    renderWithSocket(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AdminTransfers),
        React.createElement(DoctorRequestTransfer)
      ),
      socket
    );

    expect(screen.queryAllByRole("button", { name: "Accept" })).toHaveLength(0);

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "Patient One" } });

    fireEvent.click(screen.getByRole("button", { name: "Next →" }));

    fireEvent.click(await screen.findByRole("button", { name: /Target Hospital/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    fireEvent.click(screen.getByRole("button", { name: /Request Admit/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/logistics/transfer",
        expect.objectContaining({
          patientName: "Patient One",
          targetHospitalId: "h2",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    });
  });

  it("Test 3 (The Capacity Sync): accepting transfer decrements ward capacity by 1", async () => {
    const socket = createMockSocket();

    axiosInstance.get.mockResolvedValue({
      data: {
        data: {
          hospitals: [
            {
              _id: "h1",
              name: "Home Hospital",
              resources: { icuBeds: 5, generalBeds: 10, ventilatorBeds: 3 },
            },
          ],
        },
      },
    });

    axiosInstance.patch.mockResolvedValue({ data: { success: true } });

    renderWithSocket(React.createElement(AdminTransfers), socket);

    await waitFor(() => {
      const card = screen.getByText("ICU Beds").closest("div");
      expect(card).not.toBeNull();
      expect(within(card).getByText("5")).toBeInTheDocument();
    });

    act(() => {
      socket.emit("transfer-requested", {
        emittedAt: new Date().toISOString(),
        transfer: {
          _id: "tr-200",
          patientName: "Patient Two",
          requiredBedType: "icuBeds",
          requestedBy: { name: "Dr. Test" },
        },
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(axiosInstance.patch).toHaveBeenCalledWith("/logistics/transfer/tr-200/accept");
    });

    await waitFor(() => {
      const updatedCard = screen.getByText("ICU Beds").closest("div");
      expect(updatedCard).not.toBeNull();
      expect(within(updatedCard).getByText("4")).toBeInTheDocument();
    });
  });
});
