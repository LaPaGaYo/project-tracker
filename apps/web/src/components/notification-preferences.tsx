"use client";

import { useState } from "react";

import type { NotificationPreferenceRecord } from "@the-platform/shared";

type PreferenceKey =
  | "commentsEnabled"
  | "mentionsEnabled"
  | "assignmentsEnabled"
  | "githubEnabled"
  | "stateChangesEnabled";

interface NotificationPreferencesProps {
  preferences: NotificationPreferenceRecord;
  workspaceSlug: string;
  onPreferencesChange: (preferences: NotificationPreferenceRecord) => void;
}

const preferenceOptions: Array<{
  key: PreferenceKey;
  label: string;
  description: string;
}> = [
  {
    key: "commentsEnabled",
    label: "Comments",
    description: "Replies on work you follow."
  },
  {
    key: "mentionsEnabled",
    label: "Mentions",
    description: "Direct @userId attention."
  },
  {
    key: "assignmentsEnabled",
    label: "Assignments",
    description: "New ownership changes."
  },
  {
    key: "githubEnabled",
    label: "GitHub",
    description: "PRs, checks, and deploys."
  },
  {
    key: "stateChangesEnabled",
    label: "State changes",
    description: "Workflow and priority changes."
  }
];

export function NotificationPreferences({
  preferences,
  workspaceSlug,
  onPreferencesChange
}: NotificationPreferencesProps) {
  const [pendingKey, setPendingKey] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updatePreference(key: PreferenceKey, value: boolean) {
    setPendingKey(key);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/notification-preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ [key]: value })
      });

      if (!response.ok) {
        throw new Error("Failed to update notification preferences.");
      }

      const data = (await response.json()) as { preferences: NotificationPreferenceRecord };
      onPreferencesChange(data.preferences);
    } catch {
      setError("Could not update preferences.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section aria-label="Notification preferences" className="border-t border-white/8 px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-planka-text">Preferences</h3>
          <p className="text-xs text-planka-text-muted">Keep the inbox focused.</p>
        </div>
      </div>
      <div className="grid gap-2">
        {preferenceOptions.map((option) => (
          <label
            key={option.key}
            className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-2"
          >
            <span>
              <span className="block text-sm font-semibold text-planka-text">{option.label}</span>
              <span className="block text-xs text-planka-text-muted">{option.description}</span>
            </span>
            <input
              type="checkbox"
              aria-label={option.label}
              className="mt-1 h-4 w-4 accent-[#4f89ff]"
              checked={preferences[option.key]}
              disabled={pendingKey !== null}
              onChange={(event) => {
                void updatePreference(option.key, event.currentTarget.checked);
              }}
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-xs font-semibold text-[#f6b0ab]">{error}</p> : null}
    </section>
  );
}
