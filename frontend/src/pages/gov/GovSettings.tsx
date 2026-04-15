import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GovSettings = () => (
  <div>
    <TopBar title="Settings" />
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Full Name</Label><Input defaultValue="R. Menon" className="bg-secondary border-border" /></div>
          <div className="space-y-2"><Label>Email</Label><Input defaultValue="rmenon@gov.health" disabled className="bg-secondary border-border opacity-60" /></div>
          <div className="space-y-2"><Label>Role</Label><Input defaultValue="Government Official" disabled className="bg-secondary border-border opacity-60" /></div>
        </div>
        <Button>Save Changes</Button>
      </div>
    </div>
  </div>
);

export default GovSettings;
