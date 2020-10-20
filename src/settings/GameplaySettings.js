import * as immutable from "immutable";
import React, { useCallback } from "react";

import {
  SettingsFlex,
  SettingsGroup,
  SettingsToggle as UnconnectedSettingsToggle,
  SettingsUl,
} from "./Common.tsx";

export const INITIAL_SETTINGS = immutable.Map({
  automaticallyRemoveMarks: false,
  highlightAffectedMarks: true,
  highlightPeers: true,
  showConflicts: true,
  showLocked: false,
});

const SettingAction = {
  toggle: "toggle",
};

export function updateSettings(settings, { action, name }) {
  switch (action) {
    case SettingAction.toggle:
      return settings.update(name, (value) => !value);
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}

export default function GameplaySettings({ settings, dispatchSettings }) {
  return (
    <SettingsFlex>
      <SettingsGroup>
        <legend>Display</legend>
        <SettingsUl>
          <ConnectedSettingsToggle
            name="showConflicts"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Show conflicts
          </ConnectedSettingsToggle>
          <ConnectedSettingsToggle
            name="showLocked"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Show locked squares
          </ConnectedSettingsToggle>
        </SettingsUl>
      </SettingsGroup>
      <SettingsGroup>
        <legend>Pencil Marks</legend>
        <SettingsUl>
          <ConnectedSettingsToggle
            name="automaticallyRemoveMarks"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Automatically remove marks
          </ConnectedSettingsToggle>
          <ConnectedSettingsToggle
            name="highlightAffectedMarks"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Highlight affected marks (doesn't work yet)
          </ConnectedSettingsToggle>
        </SettingsUl>
      </SettingsGroup>
      <SettingsGroup>
        <legend>Selection</legend>
        <SettingsUl>
          <ConnectedSettingsToggle
            name="highlightPeers"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Highlight peers
          </ConnectedSettingsToggle>
        </SettingsUl>
      </SettingsGroup>
    </SettingsFlex>
  );
}

function ConnectedSettingsToggle({ children, name, settings, dispatch }) {
  const handleChange = useCallback(() => {
    dispatch({ action: SettingAction.toggle, name: name });
  }, [dispatch, name]);
  return (
    <UnconnectedSettingsToggle
      name={name}
      checked={settings.get(name)}
      onChange={handleChange}
    >
      {children}
    </UnconnectedSettingsToggle>
  );
}
