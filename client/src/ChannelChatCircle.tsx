import { CSSProperties, useCallback } from 'react';

interface ChannelChatCircleProps {
  started: number;
  isSelected: boolean;
  isConnected: boolean;
  missedCount: number;
  imageURL: string;
  username: string;
  onClick: (username: string) => void;
}

export default function ChannelChatCircle({
  started,
  isSelected,
  missedCount,
  isConnected,
  imageURL,
  username,
  onClick,
}: ChannelChatCircleProps) {
  const elapsed = new Date(started ? Date.now() - started : 0).toISOString().substr(11, 8);
  return (
    <li
      data-selected={isSelected}
      data-has-count={missedCount > 0}
      data-is-connected={isConnected}
      className="channel-chat-circle"
    >
      <button
        onClick={useCallback(() => onClick(username), [username, onClick])}
        title={username + ' - ' + elapsed}
        style={{ '--background-image': 'url(' + imageURL + ')' } as CSSProperties}
        key={missedCount}
      >
        {missedCount ? <span>{missedCount}</span> : null}
      </button>
    </li>
  );
}
