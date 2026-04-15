import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api";

const ActivateAccountPage = () => {
  const { activate } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const maskedToken = useMemo(() => {
    if (!token) return "";
    if (token.length <= 12) return token;
    return `${token.slice(0, 6)}…${token.slice(-6)}`;
  }, [token]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Activation token is missing.");
      return;
    }

    let cancelled = false;
    setStatus("working");
    setMessage("");

    (async () => {
      try {
        await activate(token);
        if (!cancelled) {
          setStatus("success");
          setMessage("Account activated successfully. You can now sign in.");
        }
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : "Activation failed.";
        if (!cancelled) {
          setStatus("error");
          setMessage(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activate, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-foreground">Activate your account</h1>
        {token && (
          <p className="text-xs text-muted-foreground break-all">
            Token: <span className="font-mono">{maskedToken}</span>
          </p>
        )}

        {status === "working" && <p className="text-sm text-muted-foreground">Activating…</p>}
        {status === "success" && <p className="text-sm text-foreground">{message}</p>}
        {status === "error" && <p className="text-sm text-destructive">{message}</p>}

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActivateAccountPage;

