import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { GestureAction } from "../../domain/gestures";
type Listener = (action: GestureAction) => boolean;
const Context = createContext<{
  send: (action: GestureAction) => boolean;
  subscribe: (listener: Listener) => () => void;
}>({ send: () => false, subscribe: () => () => {} });
export function GestureProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const value = useMemo(
    () => ({
      send: (action: GestureAction) => {
        let handled = false;
        for (const listener of listeners.current)
          handled = listener(action) || handled;
        return handled;
      },
      subscribe: (listener: Listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGestureCommands() {
  return useContext(Context);
}
export function useGestureReceiver(listener: Listener) {
  const latest = useRef(listener);
  latest.current = listener;
  const { subscribe } = useGestureCommands();
  useEffect(() => subscribe((action) => latest.current(action)), [subscribe]);
}
