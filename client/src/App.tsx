import './App.css';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useState } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import { useCallback } from 'react';

interface Group {
  name: string;
  slug: string;
  members: string[];
  online: string[];
}

function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupSlug, selectGroup] = useState<string>('');
  const selectedGroup = useMemo(
    () => groups.find(group => group.slug === selectedGroupSlug),
    [selectedGroupSlug, groups],
  );
  const [selectedChat, setSelectedChat] = useState('');
  const [socketUrl, setSocketURL] = useState('');

  useEffect(() => {
    setSocketURL(selectedGroup ? 'wss://' + window.location.hostname + '/api/ws?group=' + encodeURIComponent(selectedGroup.slug) : '');
  }, [selectedGroup]);

  useEffect(() => {
    fetch('/api/groups')
      .then(response => response.json())
      .then(setGroups);
  }, [setGroups]);
  const { readyState, lastJsonMessage } = useWebSocket(socketUrl, {}, !!socketUrl);

  useEffect(() => {
    console.log(lastJsonMessage);

    if (!lastJsonMessage) return;
    if (lastJsonMessage.event === 'online') {
      setGroups(groups =>
        groups.map(group => {
          if (!group.members.includes(lastJsonMessage.username) || group.online.includes(lastJsonMessage.username))
            return group;
          return { ...group, online: [...group.online, lastJsonMessage.username] };
        }),
      );
    } else if (lastJsonMessage.event === 'offline') {
      setGroups(groups =>
        groups.map(group => ({
          ...group,
          online: group.online.filter(username => username !== lastJsonMessage.username),
        })),
      );
    }
  }, [lastJsonMessage]);

  const connectionStatus = useMemo(
    () =>
      ({
        [ReadyState.CONNECTING]: 'Connecting',
        [ReadyState.OPEN]: 'Open',
        [ReadyState.CLOSING]: 'Closing',
        [ReadyState.CLOSED]: 'Closed',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
      }[readyState]),
    [readyState],
  );

  const parent = useMemo(() => encodeURIComponent(window.location.hostname), []);

  const online = useMemo(() => selectedGroup?.online || [], [selectedGroup]);

  return (
    <>
      <fieldset>
        <legend>Controls</legend>

        <select
          value={selectedGroup?.slug || undefined}
          onChange={e => selectGroup(groups.find(group => group.slug === e.currentTarget.value) ? e.target.value : '')}
        >
          <option value="" selected>
            Nothing
          </option>
          {groups.map(group => (
            <option key={group.slug} value={group.slug}>
              {group.name} {group.members.length}
            </option>
          ))}
        </select>
        <span>The WebSocket is currently {connectionStatus}</span>
      </fieldset>
      <section className="content">
        <div className="players" data-count={online.length}>
          {online.map((username, i) => (
            <iframe
              title={username}
              key={username}
              style={{ gridArea: String.fromCharCode(97 + i) }}
              src={
                `https://embed.twitch.tv/?allowfullscreen=true&channel=${username}&layout=video&theme=dark&parent=` +
                parent
              }
              allowFullScreen
            />
          ))}
        </div>
        <div className="chats">
          <select
            value={selectedChat}
            onInput={useCallback(
              e => {
                setSelectedChat(e.currentTarget.value);
              },
              [setSelectedChat],
            )}
          >
            <option value="">None</option>
            {online.map(username => (
              <option key={username}>{username}</option>
            ))}
          </select>
          {online.map(username => (
            <iframe
              title={username}
              key={username}
              data-selected={selectedChat === username}
              src={'https://www.twitch.tv/embed/' + username + '/chat?darkpopout&parent=' + parent}
            />
          ))}
        </div>
      </section>
    </>
  );
}

export default App;
