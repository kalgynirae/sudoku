import { Map } from "immutable";
import React from "react";
import styled from "styled-components";

export const INITIAL_SETTINGS = Map({
  automaticallyRemoveHints: true,
  highlightAffectedSquares: true,
  highlightErrors: true,
  highlightLocked: false,
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
    <SettingsList>
      <Toggle
        name="automaticallyRemoveHints"
        settings={settings}
        dispatch={dispatchSettings}
      >
        Automatically remove hints
      </Toggle>
      <Toggle
        name="highlightAffectedSquares"
        settings={settings}
        dispatch={dispatchSettings}
      >
        Highlight affected squares
      </Toggle>
      <Toggle
        name="highlightErrors"
        settings={settings}
        dispatch={dispatchSettings}
      >
        Highlight errors
      </Toggle>
      <Toggle
        name="highlightLocked"
        settings={settings}
        dispatch={dispatchSettings}
      >
        Highlight locked squares
      </Toggle>
    </SettingsList>
  );
}

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

const SettingsList = styled.ul`
  font-size: 1.2em;
  line-height: 1.5;
  list-style: none;
  padding: 0 0.5rem;
`;

const SettingsListItem = styled.li`
  & > label {
    padding-left: 0.5em;
  }
`;
