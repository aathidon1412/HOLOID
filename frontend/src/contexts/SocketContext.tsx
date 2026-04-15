import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const nextSocket = io(SOCKET_BASE_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    const handleConnect = () => {
      setIsConnected(true);
      if (user?.hospital) {
        nextSocket.emit("subscribe-hospital", user.hospital);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    setSocket(nextSocket);

    return () => {
      if (user?.hospital && nextSocket.connected) {
        nextSocket.emit("unsubscribe-hospital", user.hospital);
      }

      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.disconnect();

      setSocket(null);
      setIsConnected(false);
    };
  }, [accessToken, user?.hospital]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocketContext must be used within SocketProvider");
  }
  return ctx;
};

export { SocketContext };