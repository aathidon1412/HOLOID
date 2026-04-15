import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("Profile");
  const tabs = ["Profile", "Hospital Details", "Notification Preferences"];

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex gap-2 border-b border-border pb-px">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium transition-all relative ${activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {activeTab === "Profile" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground italic border-l-2 border-primary pl-2 uppercase tracking-tight">Identity Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Full Name</Label>
                  <Input defaultValue="Dr. A. Rajesh" className="bg-secondary/50 border-border h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Email</Label>
                  <Input defaultValue="admin@cityhospital.org" disabled className="bg-secondary/30 border-border opacity-60 h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Role</Label>
                  <Input defaultValue="Hospital Admin" disabled className="bg-secondary/30 border-border opacity-60 h-9 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground italic border-l-2 border-primary pl-2 uppercase tracking-tight">Security</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Current Password</Label>
                  <Input type="password" placeholder="••••••••" className="bg-secondary/50 border-border h-9 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">New Password</Label>
                    <Input type="password" field-placeholder="Enter new password" className="bg-secondary/50 border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Confirm New Password</Label>
                    <Input type="password" field-placeholder="Confirm new password" className="bg-secondary/50 border-border h-9 text-sm" />
                  </div>
                </div>
                <Button size="sm">Update Password</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Hospital Details" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground italic border-l-2 border-primary pl-2 uppercase tracking-tight">Institutional Information</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Hospital Name</Label>
                  <Input defaultValue="City General Hospital" className="bg-secondary/50 border-border h-9 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Region</Label>
                    <Input defaultValue="South Zone" className="bg-secondary/50 border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Location (GPS)</Label>
                    <Input defaultValue="13.0827° N, 80.2707° E" className="bg-secondary/50 border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Contact Phone</Label>
                    <Input defaultValue="+91 44 1234 5678" className="bg-secondary/50 border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Emergency Hotline</Label>
                    <Input defaultValue="+91 44 1234 9999" className="bg-secondary/50 border-border h-9 text-sm text-status-critical font-medium" />
                  </div>
                </div>
                <Button size="sm">Save Changes</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Notification Preferences" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4 text-sm font-semibold text-foreground italic border-l-2 border-primary pl-2 uppercase tracking-tight">
              Thresholds & Alerts
            </div>
            <div className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Alert threshold (critical beds)</p>
                <p className="text-[10px] text-muted-foreground">Get notified when ICU beds fall below this number</p>
              </div>
              <select className="bg-secondary border border-border rounded-md px-2 py-1 text-sm focus:outline-none">
                <option>2</option>
                <option selected>3</option>
                <option>5</option>
              </select>
            </div>
            {[
              { title: "Email on transfer created", desc: "Receive automated email when a new transfer starts" },
              { title: "Email on critical alert", desc: "Get priority push for all critical capacity warnings" },
              { title: "In-app alerts", desc: "Show status toast for every resource update" }
            ].map((pref, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{pref.title}</p>
                  <p className="text-[10px] text-muted-foreground">{pref.desc}</p>
                </div>
                <Switch defaultChecked={i < 2} />
              </div>
            ))}
            <Button size="sm">Apply Preferences</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
