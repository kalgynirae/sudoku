import * as immutable from "immutable";
import React from "react";
import styled from "styled-components";

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

export function Settings({ settings, dispatchSettings }) {
  return (
    <SettingsFlex>
      <SettingsGroup>
        <legend>Display</legend>
        <SettingsUl>
          <Toggle
            name="showConflicts"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Show conflicts
          </Toggle>
          <Toggle
            name="showLocked"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Show locked squares
          </Toggle>
        </SettingsUl>
      </SettingsGroup>
      <SettingsGroup>
        <legend>Pencil Marks</legend>
        <SettingsUl>
          <Toggle
            name="automaticallyRemoveMarks"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Automatically remove marks
          </Toggle>
          <Toggle
            name="highlightAffectedMarks"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Highlight affected marks (doesn't work yet)
          </Toggle>
        </SettingsUl>
      </SettingsGroup>
      <SettingsGroup>
        <legend>Selection</legend>
        <SettingsUl>
          <Toggle
            name="highlightPeers"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Highlight peers
          </Toggle>
        </SettingsUl>
      </SettingsGroup>
    </SettingsFlex>
  );
}

const SettingsFlex = styled.div`
  display: flex;
`;

const SettingsGroup = styled.fieldset`
  border: 1px solid ${(p) => p.theme.border};
  padding: 0 0.75rem;
`;

const SettingsUl = styled.ul`
  line-height: 1.5;
  list-style: none;
  padding: 0;
`;

function Toggle({ children, name, settings, dispatch }) {
  return (
    <SettingsListItem>
      <input
        type="checkbox"
        id={`setting-${name}`}
        checked={settings.get(name)}
        onChange={() => dispatch({ action: SettingAction.toggle, name: name })}
      />
      <label for={`setting-${name}`}>{children}</label>
    </SettingsListItem>
  );
}

const SettingsListItem = styled.li`
  & > label {
    padding-left: 0.5em;
  }
`;
