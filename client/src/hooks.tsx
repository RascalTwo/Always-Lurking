import { useMemo, useState, useEffect, useDebugValue, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { IS_SECURE, TWITCH_PARENT } from './constants';
import { Group } from './group';
import { GroupPayload } from './types';

const useCSA = (initialState: string): [string, React.Dispatch<React.SetStateAction<string>>, string[]] => {
  const [text, setText] = useState(initialState);
  const array = useMemo(
    () =>
      text
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean),
    [text],
  );

  useDebugValue(array);

  return [text, setText, array];
};

export const useHashState = <S extends {}>(
  defaultValue: S,
  key: string,
): [S, React.Dispatch<React.SetStateAction<S>>] => {
  const hashValue = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get(key), [key]);
  const [state, setState] = useState<S>(hashValue === null ? defaultValue : JSON.parse(hashValue))

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set(key, JSON.stringify(state));
    window.history.pushState(null, '', window.location.pathname + '#' + params.toString());
  }, [key, state]);

  useDebugValue(state);

  return [state, setState];
};

export const useHashedCSA = (
  defaultValue: string[],
  key: string,
): [string, React.Dispatch<React.SetStateAction<string>>, string[]] => {
  const [state, updateHashState] = useHashState(defaultValue, key);
  const [text, setText, array] = useCSA(state.join(','));
  useEffect(() => updateHashState(array), [key, array, updateHashState]);

  useDebugValue(array);

  return [text, setText, array];
};

export const useGroups = (): [Group[], (updater: (group: Group) => Group) => void] => {
  const [groups, setGroups] = useState<Group[]>([]);

  const updateGroups = useCallback(
    (updater: (group: Group) => Group) => setGroups(oldGroups => oldGroups.map(updater)),
    [],
  );

  useEffect(() => {
    fetch('/api/groups')
      .then(response => response.json())
      .then((groupPayloads: GroupPayload[]) => setGroups(groupPayloads.map(Group.from)));
  }, [setGroups]);

  return [groups, updateGroups];
};

export const useGroupWebsocket = (groupSlugs: string[], updateGroups: (updater: (group: Group) => Group) => void) => {
  const [socketUrl, setSocketURL] = useState('');

  useEffect(() => {
    if (!groupSlugs.length) return setSocketURL('');
    const url = new URL(`ws${IS_SECURE ? 's' : ''}://` + window.location.host + '/api/ws');
    for (const slug of groupSlugs) url.searchParams.append('group', slug);
    setSocketURL(url.toString());
  }, [groupSlugs]);

  const { readyState, lastJsonMessage } = useWebSocket(socketUrl, {}, !!socketUrl);

  useEffect(() => {
    if (!lastJsonMessage) return;
    if (lastJsonMessage.event === 'online') {
      updateGroups(group => group.addOnlineUsername(lastJsonMessage.username, lastJsonMessage.started));
    } else if (lastJsonMessage.event === 'offline') {
      updateGroups(group => group.removeOnlineUsername(lastJsonMessage.username));
    } else if (lastJsonMessage.event === 'sync') {
      updateGroups(group =>
        group.slug !== lastJsonMessage.group ? group : group.setOnline(lastJsonMessage.online),
      );
    }
  }, [lastJsonMessage, updateGroups]);

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

  return connectionStatus;
};

const useNonce = () => {
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNonce(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  return nonce;
};

export const usePlayerWindows = (displaying: string[]): [string[], (toggling: string) => void, JSX.Element] => {
  const [autoOpenWindows, setAutoOpenWindows] = useHashState(false, 'popups');
  const [openWindowUsernames, setOpenWindowUsernames] = useState<string[]>([]);
  const [openWindows, setOpenedWindows] = useState<Record<string, WindowProxy>>({});

  const nonce = useNonce();
  useEffect(() => {
    const removing = [];
    for (const username in openWindows) {
      if (openWindows[username] === null || openWindows[username].closed) removing.push(username);
    }

    if (!removing.length) return;

    const newPointWindows = { ...openWindows };
    for (const username of removing) delete newPointWindows[username];
    setOpenedWindows(newPointWindows);
  }, [openWindows, nonce]);

  useEffect(() => {
    const newUsernames = [];
    const removingUsernames = [];
    for (const username of new Set([...Object.keys(openWindows), ...openWindowUsernames])) {
      if (username in openWindows && !openWindowUsernames.includes(username)) {
        removingUsernames.push(username);
      }
      if (openWindowUsernames.includes(username) && !openWindows[username]) {
        newUsernames.push(username);
      }
    }
    if (!removingUsernames.length && !newUsernames.length) return;

    const newPointWindows = { ...openWindows };
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

    setOpenedWindows(newPointWindows);
  }, [openWindowUsernames, openWindows]);
  useEffect(() => {
    const listener = () => {
      Object.values(openWindows).forEach(w => w?.close());
      setOpenedWindows({});
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [openWindows]);

  useEffect(() => {
    if (!autoOpenWindows) return;
    setOpenWindowUsernames(collecting => displaying.filter(un => !collecting.includes(un)));
  }, [autoOpenWindows, displaying]);

  const toggleWindow = useCallback(
    toggling =>
      setOpenWindowUsernames(usernames =>
        usernames.includes(toggling) ? usernames.filter(username => username !== toggling) : [...usernames, toggling],
      ),
    [],
  );

  const PopoutElement = useMemo(
    () => (
      <label>
        Popup
        <input type="checkbox" checked={autoOpenWindows} onChange={e => setAutoOpenWindows(e.currentTarget.checked)} />
      </label>
    ),
    [autoOpenWindows, setAutoOpenWindows],
  );

  return [openWindowUsernames, toggleWindow, PopoutElement];
};
