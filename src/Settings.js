import { Map } from "immutable";
import React from "react";
import styled from "styled-components";

export const INITIAL_SETTINGS = Map({
  automaticallyRemoveHints: true,
  highlightPeers: true,
  showErrors: true,
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
        <legend>Gameplay</legend>
        <SettingsUl>
          <Toggle
            name="automaticallyRemoveHints"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Automatically remove hints
          </Toggle>
        </SettingsUl>
      </SettingsGroup>
      <SettingsGroup>
        <legend>Display</legend>
        <SettingsUl>
          <Toggle
            name="highlightPeers"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Highlight peers
          </Toggle>
          <Toggle
            name="showErrors"
            settings={settings}
            dispatch={dispatchSettings}
          >
            Show errors
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
