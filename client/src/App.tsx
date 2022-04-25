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
  const parent = useMemo(() => encodeURIComponent(window.location.hostname), []);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupSlug, selectGroup] = useState<string>(
    new URLSearchParams(window.location.hash.slice(1)).get('group') || '',
  );
  const selectedGroup = useMemo(
    () => groups.find(group => group.slug === selectedGroupSlug),
    [selectedGroupSlug, groups],
  );
  const [manualGroupText, setManualGroupText] = useState(
    new URLSearchParams(window.location.hash.slice(1)).get('manual') || '',
  );
  const manualUsernames = useMemo(
    () =>
      !selectedGroupSlug
        ? manualGroupText
            .split(',')
            .map(username => username.trim().toLowerCase())
            .filter(Boolean)
        : [],
    [selectedGroupSlug, manualGroupText],
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set('manual', manualUsernames.join(','));
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [manualUsernames]);
  const [hiddenText, setHiddenTest] = useState(new URLSearchParams(window.location.hash.slice(1)).get('hidden') || '');
  const hiddenUsernames = useMemo(
    () =>
      hiddenText
        .split(',')
        .map(username => username.trim().toLowerCase())
        .filter(Boolean),
    [hiddenText],
  );
  const [open, setOpen] = useState(!selectedGroup);
  const [selectedChat, setSelectedChat] = useState('');
  const [socketUrl, setSocketURL] = useState('');
  const [autocollectPoints, setAutocollectPoints] = useState(
    new URLSearchParams(window.location.hash.slice(1)).get('points') === 'true',
  );
  const [collectingPointUsernames, setCollectingPointUsernames] = useState<string[]>([]);
  const [pointWindows, setPointWindows] = useState<Record<string, WindowProxy>>({});
  useEffect(() => {
    const newUsernames = [];
    const removingUsernames = [];
    for (const username of new Set([...Object.keys(pointWindows), ...collectingPointUsernames])) {
      if (username in pointWindows && !collectingPointUsernames.includes(username)) {
        removingUsernames.push(username);
      }
      if (collectingPointUsernames.includes(username) && !(username in pointWindows)) {
        newUsernames.push(username);
      }
    }
    console.log({ newUsernames, removingUsernames });
    if (!removingUsernames.length && !newUsernames.length) return;
    const newPointWindows = { ...pointWindows };
    for (const removing of removingUsernames) {
      newPointWindows[removing]?.close();
      delete newPointWindows[removing];
    }
    for (const adding of newUsernames) {
      console.log(adding);
      newPointWindows[adding] = window.open(
        `https://player.twitch.tv/?channel=${adding}&enableExtensions=true&muted=true&player=popout&volume=0.0&parent=${parent}`,
        `${adding} player`,
        'width=1,height=1,dependent=1,alwaysLowered=1,left=10000,top=10000',
      )!;
      console.log(newPointWindows[adding]);
    }

    setPointWindows(newPointWindows);
  }, [collectingPointUsernames, parent, pointWindows]);
  useEffect(() => {
    const listener = () => {
      Object.values(pointWindows).forEach(w => w?.close());
      setPointWindows({});
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [pointWindows]);

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
  }, [selectedGroupSlug, selectedGroup]);

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

  const online = useMemo(() => selectedGroup?.online || [], [selectedGroup]);
  const displaying = useMemo(
    () => (manualUsernames.length ? manualUsernames : online.filter(un => !hiddenUsernames.includes(un))),
    [online, manualUsernames, hiddenUsernames],
  );
  useEffect(() => {
    if (!autocollectPoints) return;
    setCollectingPointUsernames(collecting => displaying.filter(un => !collecting.includes(un)));
  }, [autocollectPoints, displaying]);
  const players = useMemo(() => displaying.filter(un => !(un in pointWindows)), [displaying, pointWindows]);

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
          {selectedGroupSlug ? (
            <span>WebSocket: {connectionStatus}</span>
          ) : (
            <input
              value={manualGroupText}
              onChange={e => setManualGroupText(e.currentTarget.value)}
              placeholder="Manual Usernames"
            />
          )}

          <input
            value={hiddenText}
            onChange={useCallback(e => setHiddenTest(e.currentTarget.value), [])}
            placeholder="Hidden Usernames"
          />
          <label>
            Autocollect Points
            <input
              type="checkbox"
              checked={autocollectPoints}
              onChange={e => setAutocollectPoints(e.currentTarget.checked)}
            />
          </label>
        </fieldset>
      </details>
      <section className="content">
        <div className="players" data-count={players.length}>
          {players.map((username, i) => (
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
        <div className="chats" data-open={!!selectedChat}>
          <div style={selectedChat ? { width: '100%', textAlign: 'center' } : { position: 'absolute', width: '20px' }}>
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
              {displaying.map(username => (
                <option key={username}>{username}</option>
              ))}
            </select>
            <button
              onClick={useCallback(
                () =>
                  selectedChat &&
                  setCollectingPointUsernames(usernames =>
                    usernames.includes(selectedChat)
                      ? usernames.filter(un => un !== selectedChat)
                      : [...usernames, selectedChat],
                  ),
                [selectedChat],
              )}
            >
              Collect Points
            </button>
          </div>
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
