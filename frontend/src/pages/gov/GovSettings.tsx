import TopBar from "@/components/TopBar";
import ProfileManagementPanel from "@/components/ProfileManagementPanel";

const GovSettings = () => (
  <div>
    <TopBar title="Settings" />
    <div className="p-6 space-y-6 max-w-2xl">
      <ProfileManagementPanel />
    </div>
  </div>
);

export default GovSettings;
