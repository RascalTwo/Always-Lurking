import './App.css';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useState } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import { useCallback } from 'react';

interface GroupPayload {
  name: string;
  slug: string;
  members: string[];
  online: string[];
}
class Group {
  name: string;
  slug: string;
  members: string[];
  online: string[];
  constructor(name: string, slug: string, members: string[], online: string[]) {
    this.name = name;
    this.slug = slug;
    this.members = members;
    this.online = online;
  }
  static from({ name, slug, members, online }: GroupPayload) {
    return new Group(name, slug, members, online);
  }

  _sortOnlineUsernames() {
    this.online.sort((a, b) => this.members.indexOf(a) - this.members.indexOf(b));
    return this;
  }

  addOnlineUsername(username: string) {
    if (!this.members.includes(username) || this.online.includes(username)) return this;

    this.online.push(username);
    return this._sortOnlineUsernames();
  }

  removeOnlineUsername(username: string) {
    const index = this.online.indexOf(username);
    if (index === -1) return this;
    this.online.splice(index, 1);
    return this;
  }

  setOnlineUsernames(usernames: string[]) {
    this.online = usernames;

    return this._sortOnlineUsernames();
  }
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
  const [state, setState] = useState<S>(hashValue === null ? defaultValue : JSON.parse(hashValue));

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
  const { state: selectedGroupSlugs, setState: selectGroups } = useHashState<string[]>([], 'group');
  const selectedGroups = useMemo(
    () => groups.filter(group => selectedGroupSlugs.includes(group.slug)),
    [selectedGroupSlugs, groups],
  );

  useEffect(() => {
    fetch('/api/groups')
      .then(response => response.json())
      .then((groupPayloads: GroupPayload[]) => setGroups(groupPayloads.map(payload => Group.from(payload))));
  }, [setGroups]);

  return { groups, selectedGroups, selectGroups, setGroups };
};

const useGroupWebsocket = (selectedGroups: Group[], setGroups: React.Dispatch<React.SetStateAction<Group[]>>) => {
  const [socketUrl, setSocketURL] = useState('');

  useEffect(() => {
    if (!selectedGroups.length) return;
    const url = new URL(`ws${SECURE ? 's' : ''}://` + window.location.host + '/api/ws');
    for (const group of selectedGroups) url.searchParams.append('group', group.slug);
    setSocketURL(url.toString());
  }, [selectedGroups]);

  const { readyState, lastJsonMessage } = useWebSocket(socketUrl, {}, !!socketUrl);

  useEffect(() => {
    if (!lastJsonMessage) return;
    if (lastJsonMessage.event === 'online') {
      setGroups(groups => groups.map(group => group.addOnlineUsername(lastJsonMessage.username)));
    } else if (lastJsonMessage.event === 'offline') {
      setGroups(groups => groups.map(group => group.removeOnlineUsername(lastJsonMessage.username)));
    } else if (lastJsonMessage.event === 'sync') {
      setGroups(groups =>
        groups.map(group =>
          group.slug !== lastJsonMessage.group ? group : group.setOnlineUsernames(lastJsonMessage.online),
        ),
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
      if (pointWindows[username] === null || pointWindows[username].closed) removing.push(username);
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
  const { groups, selectedGroups, selectGroups, setGroups } = useGroups();
  const { connectionStatus } = useGroupWebsocket(selectedGroups, setGroups);
  const [controlsOpen, setControlsOpen] = useState(!selectedGroups.length);

  const { text: manualGroupText, array: manualUsernames, setText: setManualGroupText } = useHashedCSA('', 'manual');
  const { state: manualExclusive, setState: setManualAdditiveOrExclusive } = useHashState(
    false,
    'manualExclusive',
  );
  const { text: hiddenText, array: hiddenUsernames, setText: setHiddenTest } = useHashedCSA('', 'hidden');

  const [selectedChat, setSelectedChat] = useState('');

  const onlineUsernames = useMemo(() => [...new Set(selectedGroups.flatMap(group => group.online))], [selectedGroups]);

  const displayingUsernames = useMemo(
    () => {
      if (manualExclusive && manualUsernames.length) return manualUsernames;
      return [...new Set([...onlineUsernames.filter(un => !hiddenUsernames.includes(un)), ...manualUsernames])]
    },
    [onlineUsernames, manualUsernames, hiddenUsernames, manualExclusive],
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
              ▼ Controls
            </button>
          </legend>
          <div>
            Groups to Watch
            <select
              value={selectedGroups.map(group => group.slug)}
              onChange={e =>
                selectGroups(
                  Array.from(e.currentTarget.options)
                    .filter(opt => opt.selected)
                    .map(opt => opt.value),
                )
              }
              multiple
            >
              <option value="" selected>
                None
              </option>
              {groups.map(group => (
                <option key={group.slug} value={group.slug}>
                  {group.name} {group.members.length}
                </option>
              ))}
            </select>
            {selectedGroups.length ? (
              <span
                style={{
                  backgroundColor: connectionStatus === 'Open' ? 'lime' : 'red',
                  color: 'black',
                  margin: 'auto',
                  padding: '0.25rem',
                }}
              >
                Connection: {connectionStatus}
              </span>
            ) : null}
          </div>
          <div>
            <div>
              <input
                value={manualGroupText}
                onChange={e => setManualGroupText(e.currentTarget.value)}
                placeholder="Manual Usernames"
              />
              <label>
                Exclusive
                <input
                  type="checkbox"
                  checked={manualExclusive}
                  onChange={e => setManualAdditiveOrExclusive(e.currentTarget.checked)}
                />
              </label>
            </div>
            <input
              value={hiddenText}
              onChange={useCallback(e => setHiddenTest(e.currentTarget.value), [setHiddenTest])}
              placeholder="Hidden Usernames"
            />
          </div>
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
          {displayingUsernames.length ? (
            <div
              style={
                selectedChat
                  ? { width: '100%', textAlign: 'center' }
                  : { position: 'absolute', width: '20px', right: '75px', top: 0 }
              }
            >
              <select
                value={selectedChat}
                onInput={e => {
                  setSelectedChat(e.currentTarget.value);
                }}
              >
                <option value="">None</option>
                {displayingUsernames.map(username => (
                  <option key={username}>{username}</option>
                ))}
              </select>
              {selectedChat ? (
                <button
                  onClick={() =>
                    setCollectingPointUsernames(usernames =>
                      usernames.includes(selectedChat)
                        ? usernames.filter(un => un !== selectedChat)
                        : [...usernames, selectedChat],
                    )
                  }
                >
                  Collect Points
                </button>
              ) : null}
            </div>
          ) : null}
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
