import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtime(tables: string[], onChange: () => void, channelName?: string) {
  useEffect(() => {
    const ch = supabase.channel(channelName ?? `rt-${tables.join("-")}-${Math.random()}`);
    tables.forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange());
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), channelName]);
}
