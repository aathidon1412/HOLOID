import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/useSocket";
import { govCommandCenterService } from "@/services/govCommandCenterService";

const readableAction = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const readableEntity = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const readableDateTime = (value?: string) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const readableActor = (actor?: { role?: string; name?: string }) => {
  const name = String(actor?.name || "").trim();
  const role = String(actor?.role || "").trim();

  if (name && role) return `${name} (${role})`;
  if (name) return name;
  if (role) return role;
  return "system";
};

const GovAuditLogs = () => {
  const queryClient = useQueryClient();
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [limit, setLimit] = useState(100);

  const refreshAuditLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gov-audit-logs"] });
  }, [queryClient]);

  useSocket({ eventName: "transfer-requested", onEvent: refreshAuditLogs });
  useSocket({ eventName: "transfer-status-updated", onEvent: refreshAuditLogs });
  useSocket({ eventName: "dispatch-assigned", onEvent: refreshAuditLogs });
  useSocket({ eventName: "dispatch-responded", onEvent: refreshAuditLogs });
  useSocket({ eventName: "dispatch-progress-updated", onEvent: refreshAuditLogs });
  useSocket({ eventName: "bed-slot-status-changed", onEvent: refreshAuditLogs });
  useSocket({ eventName: "resource-updated", onEvent: refreshAuditLogs });

  const { data, isLoading } = useQuery({
    queryKey: ["gov-audit-logs", entityFilter, actionFilter, limit],
    queryFn: () =>
      govCommandCenterService.getAuditLogs({
        entityType: entityFilter === "all" ? undefined : entityFilter,
        action: actionFilter === "all" ? undefined : actionFilter,
        limit,
      }),
    refetchInterval: 8000,
  });

  const logs = data?.logs || [];

  const entityOptions = useMemo(() => {
    const options = new Set<string>(["transfer", "hospital", "resource", "user"]);
    for (const log of logs) {
      const entity = String(log.entityType || "").trim().toLowerCase();
      if (entity) options.add(entity);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const actionOptions = useMemo(() => {
    const options = new Set<string>();
    for (const log of logs) {
      const action = String(log.action || "").trim();
      if (action) options.add(action);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  return (
    <div>
      <TopBar title="System Audit Logs" />
      <div className="p-6 space-y-6">
        <div className="flex gap-4 items-center flex-wrap">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All Entities</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>
                {readableEntity(entity)}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All Actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {readableAction(action)}
              </option>
            ))}
          </select>

          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
          >
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-sm text-muted-foreground">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-sm text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{readableDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-accent px-2 py-0.5 text-xs text-foreground">{readableEntity(log.entityType)}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{readableAction(log.action)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{readableActor(log.actor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {logs.length} of {data?.count || logs.length} logs</p>
          <div className="flex gap-2">
            <span className="px-3 py-1 text-xs text-muted-foreground">Auto-refresh every 8s</span>
          </div>
        </div>

        <Button variant="outline">Export Audit Log</Button>
      </div>
    </div>
  );
};

export default GovAuditLogs;
