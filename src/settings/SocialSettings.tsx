import React, { useCallback, useState } from "react";

import { Button as ActualButton } from "../Buttons";
import LocalGameState from "../gameLogic/LocalGameState";
import RemoteGameState from "../gameLogic/RemoteGameState";
import {
  SettingsFlex,
  SettingsGroup,
  SettingsListItem,
  SettingsToggle,
  SettingsUl,
} from "./Common";

type Props = {
  forceLocalhost: boolean;
  gameState: LocalGameState | RemoteGameState;
  onSetGameState: (gs: LocalGameState | RemoteGameState) => void;
};

// HACK: Button isn't typed, and typescript infers the wrong prop types
const Button: any = ActualButton;

function getUrl(roomId?: string | null) {
  const newURL = new URL(window.location.href);
  if (roomId == null) {
    newURL.searchParams.delete("room");
  } else {
    newURL.searchParams.set("room", roomId);
    newURL.searchParams.delete("board");
  }
  return newURL;
}

export default function SocialSettings({
  gameState,
  onSetGameState,
}: Props): React.ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const isRemote = gameState instanceof RemoteGameState;

  const handlePlayOnline = useCallback(() => {
    let canceled = false;
    (async () => {
      setIsLoading(true);
      const newGs = new RemoteGameState();
      await newGs.connect(null, gameState.getBoardState());
      if (canceled) {
        return;
      }
      setIsLoading(false);
      gameState.close();
      onSetGameState(newGs);
      window.history.replaceState(null, "", getUrl(newGs.roomId).href);
    })();
    return () => {
      canceled = true;
    };
  }, [gameState, onSetGameState]);

  const handlePlayOffline = useCallback(() => {
    gameState.close();
    onSetGameState(new LocalGameState(gameState.getBoardState()));
    window.history.replaceState(null, "", getUrl(null).href);
  }, [gameState, onSetGameState]);

  const handlePlayOnlineToggle = useCallback(() => {
    if (isRemote) {
      handlePlayOffline();
    } else {
      handlePlayOnline();
    }
  }, [isRemote, handlePlayOnline, handlePlayOffline]);

  const handleCopyToClipboardClick = useCallback(() => {
    // the current room ID should be in the URL already
    navigator.clipboard.writeText(window.location.href);
  }, []);

  return (
    <SettingsFlex>
      <SettingsGroup>
        <legend>Online Multiplayer</legend>
        <SettingsUl>
          <SettingsToggle
            name="play-coop"
            checked={isRemote || isLoading}
            disabled={isLoading}
            onChange={handlePlayOnlineToggle}
          >
            {!isLoading && "Play Co-op Online with Friends"}
            {isLoading && "Loading Online Session..."}
          </SettingsToggle>
          {isRemote && (
            <SettingsListItem>
              <Button onClick={handleCopyToClipboardClick}>
                Copy Link to Clipboard
              </Button>
            </SettingsListItem>
          )}
        </SettingsUl>
      </SettingsGroup>
    </SettingsFlex>
  );
}
