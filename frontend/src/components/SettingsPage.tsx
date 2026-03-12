import { useState } from "react";
import { Lock, Info, LogOut, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronRight } from "lucide-react";
import { useProfile } from "../hooks/useQueries";
import { UserAvatar } from "./UserAvatar";
import { SettingsItem } from "./SettingsItem";
import { EditProfileDialog } from "./EditProfileDialog";
import { BlockedUsersDialog } from "./BlockedUsersDialog";
import { EmailVerificationSection } from "./EmailVerificationSection";
import { EmailServiceConfig } from "./EmailServiceConfig";
import { BackupRestoreSection } from "./BackupRestoreSection";

interface SettingsPageProps {
  onLogout: () => void;
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { data: profile } = useProfile();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 space-y-6 pb-8">
          {/* Profile section */}
          {profile && (
            <button
              onClick={() => setShowEditProfile(true)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border hover:bg-accent transition-colors text-left"
            >
              <UserAvatar
                name={profile.name}
                avatarBlob={profile.avatar ?? null}
                className="h-14 w-14"
                fallbackClassName="text-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate">
                  {profile.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {profile.bio || "Add a bio..."}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          )}

          {/* Privacy & Security */}
          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider px-1">
              Privacy & Security
            </h2>
            <div className="rounded-xl border divide-y">
              <SettingsItem
                icon={Ban}
                label="Blocked Users"
                description="Manage blocked contacts"
                onClick={() => setShowBlocked(true)}
              />
              <EmailVerificationSection />
            </div>
          </div>

          {/* Email Service */}
          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider px-1">
              Email Service
            </h2>
            <div className="rounded-xl border divide-y">
              <EmailServiceConfig />
            </div>
          </div>

          {/* Data */}
          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider px-1">
              Data
            </h2>
            <div className="rounded-xl border divide-y">
              <BackupRestoreSection />
            </div>
          </div>

          {/* About */}
          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider px-1">
              About
            </h2>
            <div className="rounded-xl border divide-y">
              <SettingsItem
                icon={Lock}
                label="SecureChat"
                description="Private messaging on the Internet Computer"
              />
              <SettingsItem icon={Info} label="Version" description="1.0.0" />
            </div>
          </div>

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 gap-2"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </ScrollArea>

      {profile && (
        <EditProfileDialog
          open={showEditProfile}
          onOpenChange={setShowEditProfile}
          currentName={profile.name}
          currentBio={profile.bio}
          currentAvatar={profile.avatar ?? null}
        />
      )}

      <BlockedUsersDialog open={showBlocked} onOpenChange={setShowBlocked} />

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You can log back in anytime with Internet Identity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onLogout}>Log Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
