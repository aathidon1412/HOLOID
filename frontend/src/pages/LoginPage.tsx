import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import holoidLogo from "@/assets/holoid_logo.png";
import { ApiClientError } from "@/lib/api";

const ROLE_ROUTES: Record<UserRole, string> = {
  HOSPITAL_ADMIN: "/admin/inventory",
  DOCTOR: "/doctor/overview",
  BED_MANAGER: "/bed-manager/entry",
  AMBULANCE_DRIVER: "/ambulance/dispatch",
  GOVERNMENT_OFFICIAL: "/gov/command-center",
};

const LoginPage = () => {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [hospitalId, setHospitalId] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string>("");
  const [postRegisterMessage, setPostRegisterMessage] = useState<string>("");
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string }>>([]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWorking(true);
    setError("");
    try {
      const user = await login(email, password);
      navigate(ROLE_ROUTES[user.role]);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Login failed.";
      setError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWorking(true);
    setError("");
    setPostRegisterMessage("");
    try {
      // Validate hospital selection for roles that require it
      if (role !== "GOVERNMENT_OFFICIAL" && !hospitalId.trim()) {
        setError("Please select a hospital");
        setIsWorking(false);
        return;
      }

      const result = await register({
        name,
        email,
        password,
        role,
        hospitalId: hospitalId.trim() ? hospitalId.trim() : null,
      });

      setMode("signin");
      setPassword("");

      if (result.pendingApproval) {
        setPostRegisterMessage("Account created and is pending approval. You will receive an activation email after approval.");
      } else if (result.activationEmailSent) {
        setPostRegisterMessage("Account created. Please check your email for the activation link.");
      } else {
        setPostRegisterMessage("Account created. Activation email was skipped (mailer not configured).");
      }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Registration failed.";
      setError(msg);
    } finally {
      setIsWorking(false);
    }
  };

  // Fetch hospitals for dropdown when role requires them
  useMemo(() => {
    const needsHospital = role !== "GOVERNMENT_OFFICIAL";
    if (!needsHospital) {
      setHospitals([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await (await import("@/lib/api")).apiRequest<any>(`/hospitals/list`);
        if (!cancelled && res && res.data && Array.isArray(res.data.hospitals)) {
          setHospitals(
            res.data.hospitals.map((h: any) => ({ id: h._id || h.id, name: h.name || h._id || h.id }))
          );
        }
      } catch (e) {
        // ignore — keep hospitals empty so user can paste an id
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-center items-center p-12 bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {/* Network animation dots */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-primary pulse-live"
              style={{
                width: `${4 + Math.random() * 6}px`,
                height: `${4 + Math.random() * 6}px`,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center space-y-8">
          <img src={holoidLogo} alt="HOLOID" className="h-32 mx-auto" />
          <div className="space-y-2">
            <p className="text-lg text-sidebar-foreground/80">Hospital Bed & Resource Management System</p>
            <p className="text-sm text-sidebar-foreground/50">Emergency Operations Portal</p>
          </div>
          <div className="flex flex-col items-start gap-3 mt-8 text-sm text-sidebar-foreground/60">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-vacant" />
              <span>Vacant / Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-warning" />
              <span>Maintenance / Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-critical" />
              <span>Critical / Occupied</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <img src={holoidLogo} alt="HOLOID" className="h-12 mx-auto lg:hidden" />
            <h1 className="text-2xl font-bold text-foreground">Secure Access Portal</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to access the system" : "Create your account"}
            </p>
          </div>

          {(error || postRegisterMessage) && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                error ? "border-destructive/40 text-destructive" : "border-border text-foreground"
              }`}
            >
              {error || postRegisterMessage}
            </div>
          )}

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary border-border pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isWorking}>
                {isWorking ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                New here?{" "}
                <button type="button" onClick={() => setMode("register")} className="text-primary hover:underline">
                  Create Account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email Address</Label>
                <Input id="reg-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Select Role</Label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                  <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="BED_MANAGER">Bed Manager</option>
                  <option value="AMBULANCE_DRIVER">Ambulance Driver</option>
                  <option value="GOVERNMENT_OFFICIAL">Government Official</option>
                </select>
              </div>
              {role !== "GOVERNMENT_OFFICIAL" && (
                <div className="space-y-2">
                  <Label htmlFor="hospitalId">Hospital</Label>
                  {hospitals.length > 0 ? (
                    <select
                      id="hospitalId"
                      value={hospitalId}
                      onChange={(e) => setHospitalId(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Select hospital (required for this role)</option>
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="hospitalId"
                      placeholder="MongoDB hospitalId or leave blank"
                      value={hospitalId}
                      onChange={(e) => setHospitalId(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isWorking}>
                {isWorking ? "Creating..." : "Create Account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                After registering, you must activate your account via the email link before you can sign in.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Already registered?{" "}
                <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">
                  Sign In
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
