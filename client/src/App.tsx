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

const SECURE = window.location.protocol.includes('s');

function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupSlug, selectGroup] = useState<string>(
    new URLSearchParams(window.location.hash.slice(1)).get('group') || '',
  );
  const selectedGroup = useMemo(
    () => groups.find(group => group.slug === selectedGroupSlug),
    [selectedGroupSlug, groups],
  );
  const [hiddenText, setHiddenTest] = useState(new URLSearchParams(window.location.hash.slice(1)).get('hidden') || '');
  const hiddenUsernames = useMemo(
    () => hiddenText.split(',').map(username => username.trim().toLowerCase()),
    [hiddenText],
  );
  const [open, setOpen] = useState(!selectedGroup);
  const [selectedChat, setSelectedChat] = useState('');
  const [socketUrl, setSocketURL] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set('hidden', hiddenUsernames.join(','));
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [hiddenUsernames]);

  useEffect(() => {
    setSocketURL(
      selectedGroup
        ? `ws${SECURE ? 's' : ''}://` + window.location.host + '/api/ws?group=' + encodeURIComponent(selectedGroup.slug)
        : '',
    );

    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set('group', selectedGroupSlug);
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [selectedGroup]);

  useEffect(() => {
    fetch('/api/groups')
      .then(response => response.json())
      .then(setGroups);
  }, [setGroups]);
  const { readyState, lastJsonMessage } = useWebSocket(socketUrl, {}, !!socketUrl);

  useEffect(() => {
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
  const displaying = useMemo(() => online.filter(un => !hiddenUsernames.includes(un)), [online, hiddenUsernames]);

  return (
    <>
      <details open={open} onToggle={useCallback(e => setOpen(e.currentTarget.open), [])}>
        <summary>Controls</summary>
        <fieldset>
          <legend>
            <button style={{ all: 'unset' }} onClick={useCallback(() => setOpen(open => !open), [])}>
              Controls
            </button>
          </legend>
          <select
            value={selectedGroup?.slug || undefined}
            onChange={e =>
              selectGroup(groups.find(group => group.slug === e.currentTarget.value) ? e.target.value : '')
            }
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
          <span>WebSocket: {connectionStatus}</span>
          <input value={hiddenText} onChange={useCallback(e => setHiddenTest(e.currentTarget.value), [])} />
        </fieldset>
      </details>
      <section className="content">
        <div className="players" data-count={displaying.length}>
          {displaying.map((username, i) => (
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
            style={selectedChat ? { width: '100%', textAlign: 'center' } : { position: 'absolute', width: '20px' }}
          >
            <option value="">None</option>
            {displaying.map(username => (
              <option key={username}>{username}</option>
            ))}
          </select>
          {displaying.map(username => (
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
