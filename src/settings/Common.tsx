/**
 * Dumb shared UI components used by GameplaySettings and SocialSettings.
 */

import React from "react";
import styled from "styled-components";

export const SettingsFlex = styled.div`
  display: flex;
`;

export const SettingsGroup = styled.fieldset`
  border: 1px solid ${(p) => p.theme.border};
  padding: 0 0.75rem;
`;

export const SettingsUl = styled.ul`
  line-height: 1.5;
  list-style: none;
  padding: 0;
`;

export const SettingsListItem = styled.li`
  & > label {
    padding-left: 0.5em;
  }
`;

export const SettingsInput = styled.input`
  &:disabled + label {
    opacity: 50%;
  }
`;

type SettingsToggleProps = {
  checked: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  name: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
};

export function SettingsToggle({
  checked,
  children,
  disabled = false,
  name,
  onChange,
}: SettingsToggleProps) {
  return (
    <SettingsListItem>
      <SettingsInput
        checked={checked}
        disabled={disabled}
        id={`setting-${name}`}
        onChange={onChange}
        type="checkbox"
      />
      <label htmlFor={`setting-${name}`}>{children}</label>
    </SettingsListItem>
  );
}
