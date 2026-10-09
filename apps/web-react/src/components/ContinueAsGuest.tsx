import { UserRound } from "lucide-react";

import { ProviderButton } from "@/components/ProviderButton";

/** The way in without an account. The planner is kept in this browser only, so it says so. */
export function ContinueAsGuest({ disabled, onContinue }: { disabled?: boolean; onContinue: () => void }) {
  return (
    <div className="mt-3 space-y-1.5">
      <ProviderButton icon={<UserRound className="h-4 w-4" />} onClick={onContinue} disabled={disabled}>
        Continue as guest
      </ProviderButton>
      <p className="text-center text-xs text-muted-foreground">
        Your planner stays in this browser. Create an account later to use it on other devices.
      </p>
    </div>
  );
}
