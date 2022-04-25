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
const TWITCH_PARENT = encodeURIComponent(window.location.hostname);

const useCSA = (initialState: string) => {
  const [text, setText] = useState(initialState);
  const array = useMemo(
    () =>
      text
        .split(',')
        .map(username => username.trim().toLowerCase())
        .filter(Boolean),
    [text],
  );

  return { array, setText };
};

const useHashState = <S extends {}>(defaultValue: S, key: string) => {
  const hashValue = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get(key), [key]);
  const [state, setState] = useState(hashValue === null ? defaultValue : JSON.parse(hashValue));

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set(key, JSON.stringify(state));
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [key, state]);
  return { state, setState };
};

const useHashedCSA = (defaultValue: string, key: string) => {
  const hashValue = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get(key), [key]);
  const [text, setText] = useState<string>(hashValue || defaultValue);
  const array = useMemo(
    () =>
      text
        .split(',')
        .map(username => username.trim().toLowerCase())
        .filter(Boolean),
    [text],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set(key, text);
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [key, text]);

  return { text, array, setText };
};

const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const { state: selectedGroupSlug, setState: selectGroup } = useHashState('', 'group');
  const selectedGroup = useMemo(
    () => groups.find(group => group.slug === selectedGroupSlug),
    [selectedGroupSlug, groups],
  );

  useEffect(() => {
    fetch('/api/groups')
      .then(response => response.json())
      .then(setGroups);
  }, [setGroups]);

  return { groups, selectedGroup, selectGroup, setGroups };
};

const useGroupWebsocket = (
  selectedGroup: Group | undefined,
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>,
) => {
  const [socketUrl, setSocketURL] = useState('');

  useEffect(() => {
    setSocketURL(
      selectedGroup
        ? `ws${SECURE ? 's' : ''}://` + window.location.host + '/api/ws?group=' + encodeURIComponent(selectedGroup.slug)
        : '',
    );
  }, [selectedGroup]);

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
  }, [lastJsonMessage, setGroups]);

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

  return { connectionStatus };
};

const usePointCollecting = (displaying: string[]) => {
  const { state: autocollectPoints, setState: setAutocollectPoints } = useHashState(false, 'points');
  const [collectingPointUsernames, setCollectingPointUsernames] = useState<string[]>([]);
  const [pointWindows, setPointWindows] = useState<Record<string, WindowProxy>>({});

  const [check, setCheck] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setCheck(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const removing = [];
    for (const username in pointWindows) {
      if (pointWindows[username].closed) removing.push(username);
    }

    if (!removing.length) return;

    const newPointWindows = { ...pointWindows };
    for (const username of removing) delete newPointWindows[username];
    setPointWindows(newPointWindows);
  }, [pointWindows, check]);

  useEffect(() => {
    const newUsernames = [];
    const removingUsernames = [];
    for (const username of new Set([...Object.keys(pointWindows), ...collectingPointUsernames])) {
      if (username in pointWindows && !collectingPointUsernames.includes(username)) {
        removingUsernames.push(username);
      }
      if (collectingPointUsernames.includes(username) && !pointWindows[username]) {
        newUsernames.push(username);
      }
    }
    if (!removingUsernames.length && !newUsernames.length) return;
    const newPointWindows = { ...pointWindows };
    for (const removing of removingUsernames) {
      newPointWindows[removing]?.close();
      delete newPointWindows[removing];
    }
    for (const adding of newUsernames) {
      newPointWindows[adding] = window.open(
        `https://player.twitch.tv/?channel=${adding}&enableExtensions=true&muted=true&player=popout&volume=0.0&parent=${TWITCH_PARENT}`,
        `${adding} player`,
        'width=1,height=1,dependent=1,alwaysLowered=1,left=10000,top=10000',
      )!;
    }

    setPointWindows(newPointWindows);
  }, [collectingPointUsernames, pointWindows]);
  useEffect(() => {
    const listener = () => {
      Object.values(pointWindows).forEach(w => w?.close());
      setPointWindows({});
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [pointWindows]);
  useEffect(() => {
    if (!autocollectPoints) return;
    setCollectingPointUsernames(collecting => displaying.filter(un => !collecting.includes(un)));
  }, [autocollectPoints, displaying]);

  return { pointWindows, autocollectPoints, setAutocollectPoints, setCollectingPointUsernames };
};

function App() {
  const { groups, selectedGroup, selectGroup, setGroups } = useGroups();
  const { connectionStatus } = useGroupWebsocket(selectedGroup, setGroups);
  const [controlsOpen, setControlsOpen] = useState(!selectedGroup);

  const { text: manualGroupText, array: manualUsernames, setText: setManualGroupText } = useHashedCSA('', 'manual');
  const { text: hiddenText, array: hiddenUsernames, setText: setHiddenTest } = useHashedCSA('', 'hidden');

  const [selectedChat, setSelectedChat] = useState('');

  const onlineUsernames = useMemo(() => selectedGroup?.online || [], [selectedGroup]);
  const displayingUsernames = useMemo(
    () => (manualUsernames.length ? manualUsernames : onlineUsernames.filter(un => !hiddenUsernames.includes(un))),
    [onlineUsernames, manualUsernames, hiddenUsernames],
  );
  const { autocollectPoints, setAutocollectPoints, pointWindows, setCollectingPointUsernames } =
    usePointCollecting(displayingUsernames);
  const players = useMemo(
    () => displayingUsernames.filter(un => !pointWindows[un]),
    [displayingUsernames, pointWindows],
  );

  return (
    <>
      <details open={controlsOpen} onToggle={useCallback(e => setControlsOpen(e.currentTarget.open), [])}>
        <summary>Controls</summary>
        <fieldset>
          <legend>
            <button style={{ all: 'unset' }} onClick={useCallback(() => setControlsOpen(open => !open), [])}>
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
          {selectedGroup ? (
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
                TWITCH_PARENT
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
              {displayingUsernames.map(username => (
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
          {displayingUsernames.map(username => (
            <iframe
              title={username}
              key={username}
              data-selected={selectedChat === username}
              src={'https://www.twitch.tv/embed/' + username + '/chat?darkpopout&parent=' + TWITCH_PARENT}
            />
          ))}
        </div>
      </section>
    </>
  );
}

export default App;
