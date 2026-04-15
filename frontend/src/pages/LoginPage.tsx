import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import holoidLogo from "@/assets/holoid_logo.png";

const ROLE_ROUTES: Record<UserRole, string> = {
  HOSPITAL_ADMIN: "/admin/inventory",
  DOCTOR: "/doctor/overview",
  GOVERNMENT_OFFICIAL: "/gov/command-center",
};

const LoginPage = () => {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [hospital, setHospital] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password);
    // For demo: route based on email
    if (email.includes("gov")) navigate("/gov/command-center");
    else if (email.includes("doctor")) navigate("/doctor/overview");
    else navigate("/admin/inventory");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    register({ name, email, password, role, hospital });
    navigate(ROLE_ROUTES[role]);
  };

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

          {/* Quick Login Buttons (Demo) */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-sm">
            <p className="text-muted-foreground text-[10px] text-center uppercase tracking-widest font-bold">Quick Demo Entry</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEmail("admin@hospital.com"); }} className="flex-1 h-8 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-all">Admin</Button>
              <Button variant="outline" size="sm" onClick={() => { setEmail("doctor@hospital.com"); }} className="flex-1 h-8 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-all">Doctor</Button>
              <Button variant="outline" size="sm" onClick={() => { setEmail("gov@health.gov"); }} className="flex-1 h-8 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-all">Gov</Button>
            </div>
          </div>

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
              <Button type="submit" className="w-full">Sign In</Button>
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
                  <option value="GOVERNMENT_OFFICIAL">Government Official</option>
                </select>
              </div>
              {role !== "GOVERNMENT_OFFICIAL" && (
                <div className="space-y-2">
                  <Label htmlFor="hospital">Hospital</Label>
                  <Input id="hospital" placeholder="Search or select hospital" value={hospital} onChange={(e) => setHospital(e.target.value)} className="bg-secondary border-border" />
                </div>
              )}
              <Button type="submit" className="w-full">Create Account</Button>
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
