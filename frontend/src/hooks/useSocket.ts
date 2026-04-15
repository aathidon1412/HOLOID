import { useEffect } from "react";

import { useSocketContext } from "@/contexts/SocketContext";

type UseSocketOptions<TPayload> = {
  eventName?: string;
  onEvent?: (payload: TPayload) => void;
};

export const useSocket = <TPayload = unknown>({
  eventName,
  onEvent,
}: UseSocketOptions<TPayload> = {}) => {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !eventName || !onEvent) return;

    socket.on(eventName, onEvent as (...args: unknown[]) => void);

    return () => {
      socket.off(eventName, onEvent as (...args: unknown[]) => void);
    };
  }, [eventName, onEvent, socket]);

  return { socket, isConnected };
};
