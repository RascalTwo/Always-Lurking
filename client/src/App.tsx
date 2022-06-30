import './App.css';
import React, { useState, useEffect, useMemo, useCallback, useDebugValue } from 'react';
import Joyride, { ACTIONS, CallBackProps } from 'react-joyride';

import 'react-checkbox-tree/lib/react-checkbox-tree.css';
import CheckboxTree from 'react-checkbox-tree';

import { TWITCH_PARENT } from './constants';
import { useGroups, useGroupWebsocket, useHashedCSA, useHashState, usePlayerWindows } from './hooks';
import { Group } from './group';
import Schedule from './Schedule';

const useAutoplay = (): [boolean, JSX.Element] => {
  const [autoplay, setAutoplay] = useHashState(true, 'autoplay');

  const updateAutoplay = useCallback(e => setAutoplay(e.currentTarget.checked), [setAutoplay]);

  const AutoplayElement = useMemo(
    () => (
      <label>
        Autoplay
        <input type="checkbox" checked={autoplay} onChange={updateAutoplay} />
      </label>
    ),
    [autoplay, updateAutoplay],
  );

  useDebugValue(autoplay);

  return [autoplay, AutoplayElement];
};

const useAdditionalUsernames = (): [string[], JSX.Element] => {
  const [additionalUsernamesText, setAdditionalUsernamesText, additionalUsernames] = useHashedCSA([], 'additional');

  const updateAdditionalUsernamesText = useCallback(
    e => setAdditionalUsernamesText(e.currentTarget.value),
    [setAdditionalUsernamesText],
  );

  const AdditionalUsernamesElement = useMemo(
    () => (
      <input
        value={additionalUsernamesText}
        onChange={updateAdditionalUsernamesText}
        placeholder="Additional Usernames"
      />
    ),
    [additionalUsernamesText, updateAdditionalUsernamesText],
  );

  useDebugValue(additionalUsernames);

  return [additionalUsernames, AdditionalUsernamesElement];
};

const useJoyride = (): [() => void, JSX.Element] => {
  const steps = useMemo(
    () => [
      {
        target: 'body',
        content:
          'The Twitch stream viewer allows you to never miss a stream from predefined list of these groups of streamers, with customizability to show and hide streamers as you see fit.',
      },
      {
        target: 'fieldset',
        content: 'Choosing which group(s) to watch and further customizations can be done via the Controls section',
      },
      {
        target: '.players',
        content: 'You can watch all the selected streamers',
        placement: 'right',
      },
      {
        target: '.chats select',
        content:
          'In addition, choose which chat you wish to participate in - without missing any messages in other chats',
        placement: 'left',
      },
      {
        target: '.react-checkbox-tree',
        content: 'Here you can select which group/group members you want to be watching - if any',
      },
      {
        target: 'input[placeholder="Additional Usernames"]',
        content:
          'and even add more streamers - separated by commas - you wish to watch not in any of the selected groups',
      },
      {
        target: 'legend button',
        content: "finally you can close these controls when you're done with them!",
      },
    ],
    [],
  );

  const joyrideKey = useMemo(() => 'always-lurking-onboarded' + process.env.REACT_APP_VERSION, []);

  const [onboarding, setOnboarding] = useState(!window.localStorage.getItem(joyrideKey));
  const toggleJoyride = useCallback(() => setOnboarding(onboarding => !onboarding), [setOnboarding]);

  useEffect(() => {
    window.localStorage.setItem(joyrideKey, (+onboarding).toString());
  }, [onboarding, joyrideKey]);

  const onOnboardChange = useCallback(
    (props: CallBackProps) => {
      if (props.action === ACTIONS.RESET || props.action === ACTIONS.CLOSE) setOnboarding(false);
    },
    [setOnboarding],
  );
  const JoyrideElement = useMemo(
    // @ts-ignore
    () => <Joyride run={onboarding} steps={steps} continuous={true} callback={onOnboardChange} />,
    [onOnboardChange, onboarding, steps],
  );

  useDebugValue(onboarding);

  return [toggleJoyride, JoyrideElement];
};

const useCheckboxTree = (
  groups: Group[],
  selectGroups: React.Dispatch<React.SetStateAction<string[]>>,
): [string[], JSX.Element] => {
  const [encoded, setEncoded] = useHashState<Record<string, string[]>>({}, 'selected');
  const decoded = useMemo(
    () => Object.entries(encoded).flatMap(([group, members]) => members.map(member => JSON.stringify([group, member]))),
    [encoded],
  );
  const [rawSelectedUsernames, setSelectedUsernames] = useState(decoded);
  useEffect(() => {
    if (JSON.stringify(decoded) !== JSON.stringify(rawSelectedUsernames))
      setEncoded(
        rawSelectedUsernames.reduce((map, value) => {
          const [group, channel] = JSON.parse(value);
          if (!(group in map)) map[group] = [];
          map[group].push(channel);
          return map;
        }, {} as Record<string, string[]>),
      );
  }, [decoded, rawSelectedUsernames, setEncoded]);

  const selectedUsernames = useMemo(
    () =>
      rawSelectedUsernames
        .map(data => JSON.parse(data)[1])
        .filter((username, i, array) => array.indexOf(username) === i),
    [rawSelectedUsernames],
  );

  useEffect(
    () =>
      selectGroups(
        groups
          .filter(group => group.members.some(member => selectedUsernames.includes(member)))
          .map(group => group.slug),
      ),
    [selectedUsernames, groups, selectGroups],
  );

  const [expanded, setExpanded] = useState<string[]>([]);

  const treeNodes = useMemo(
    () =>
      groups.map(group => ({
        value: group.slug,
        label: `${group.name} - (${group.online.length}/${group.members.length})`,
        title: `${group.name} - ${group.online.length} of ${group.members.length} currently online`,
        children: group.members.map(member => ({
          value: JSON.stringify([group.slug, member]),
          label: member,
          className: `rct-username-o${group.online.find(online => online.username === member) ? 'n' : 'ff'}line`,
        })),
      })),
    [groups],
  );

  const CheckboxTreeElement = useMemo(
    () => (
      // @ts-ignore
      <CheckboxTree
        nodes={treeNodes}
        checked={rawSelectedUsernames}
        expanded={expanded}
        onCheck={setSelectedUsernames}
        onExpand={setExpanded}
      />
    ),
    [rawSelectedUsernames, expanded, treeNodes, setSelectedUsernames],
  );

  useDebugValue(rawSelectedUsernames);

  return [selectedUsernames, CheckboxTreeElement];
};

const useGroupSelector = () => {
  const [groups, updateGroups] = useGroups();

  const [selectedGroupSlugs, selectGroups] = useState<string[]>([]);
  const selectedGroups = useMemo(
    () => groups.filter(group => selectedGroupSlugs.includes(group.slug)),
    [selectedGroupSlugs, groups],
  );
  const [additionalUsernames, AdditionalUsernamesElement] = useAdditionalUsernames();

  const [selectedUsernames, CheckboxTreeElement] = useCheckboxTree(groups, selectGroups);

  const GroupSelectorElement = useMemo(
    () => (
      <div>
        Groups to watch
        {CheckboxTreeElement}
        {AdditionalUsernamesElement}
      </div>
    ),
    [CheckboxTreeElement, AdditionalUsernamesElement],
  );

  useDebugValue(selectedGroups.map(g => g.slug));

  return {
    selectedUsernames,
    selectedGroups,
    additionalUsernames,
    GroupSelectorElement,
    connectionStatus: useGroupWebsocket(selectedGroupSlugs, updateGroups),
  };
};

function ToggleableDetails({
  defaultOpen = true,
  connectionStatus,
  children,
}: {
  defaultOpen?: boolean;
  connectionStatus: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={useCallback(e => setOpen(e.currentTarget.open), [])}>
      <summary className="connectionIndicator" data-status={connectionStatus}>
        Controls
      </summary>
      <fieldset>
        <legend className="connectionIndicator" data-status={connectionStatus}>
          <button onClick={useCallback(() => setOpen(open => !open), [])}>▼ Controls</button>
        </legend>
        {children}
      </fieldset>
    </details>
  );
}

function UptimeTicker({ started }: { started: number | null }){
  const [elapsed, setElapsed] = useState(() => started ? Date.now() - started : 0);
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setElapsed(elapsed => elapsed + 1000), 1000);
    return () => clearInterval(interval);
  }, [started]);

  if (!started) return null;

  return <time dateTime={new Date(started).toISOString()} className="uptime">{new Date(elapsed).toISOString().substr(11, 8)}</time>
}

function App() {
  const { selectedUsernames, selectedGroups, additionalUsernames, GroupSelectorElement, connectionStatus } =
    useGroupSelector();

  const [toggleJoyride, JoyrideElement] = useJoyride();
  const [autoplay, AutoplayElement] = useAutoplay();

  const [selectedChat, setSelectedChat] = useState('');

  const onlineUsernames = useMemo(() => [...new Set(selectedGroups.flatMap(group => group.online))], [selectedGroups]);

  const displayingUsernames = useMemo(() => {
    return [
      ...new Set([
        ...onlineUsernames.map(online => online.username).filter(un => selectedUsernames.includes(un)),
        ...additionalUsernames,
      ]),
    ];
  }, [onlineUsernames, additionalUsernames, selectedUsernames]);

  const [openWindowUsernames, toggleWindow, PopoutElement] = usePlayerWindows(displayingUsernames);

  const players = useMemo(
    () => displayingUsernames.filter(un => !openWindowUsernames.includes(un)),
    [displayingUsernames, openWindowUsernames],
  );

  const updateSelectedChat = useCallback(e => setSelectedChat(e.currentTarget.value), []);
  const togglePoppedOut = useCallback(() => toggleWindow(selectedChat), [selectedChat, toggleWindow]);

  const [schedule, setSchedule] = useState(false);
  const requestedUsernames = useMemo(
    () => [...new Set([...selectedUsernames, ...additionalUsernames])],
    [selectedUsernames, additionalUsernames],
  );

  return (
    <>
      {JoyrideElement}
      {schedule ? <Schedule usernames={requestedUsernames} /> : null}
      <ToggleableDetails defaultOpen={!selectedGroups.length} connectionStatus={connectionStatus}>
        {GroupSelectorElement}
        <div>
          {PopoutElement}
          {AutoplayElement}
          <button onClick={toggleJoyride}>Help</button>
          <button onClick={useCallback(() => setSchedule(schedule => !schedule), [setSchedule])}>
            {schedule ? 'Hide' : 'Show'} Schedule
          </button>
        </div>
      </ToggleableDetails>
      <section className="content">
        <div className="players" data-count={players.length}>
          {players.map((username, i) => (
            <div className="player-wrapper" style={{ gridArea: String.fromCharCode(97 + i) }}>
              <UptimeTicker started={onlineUsernames.find(online => online.username === username)?.started || null} />
              <iframe
                title={username}
                key={username}
                src={
                  `https://embed.twitch.tv/?allowfullscreen=true&channel=${username}&layout=video&theme=dark&autoplay=${autoplay}&parent=` +
                  TWITCH_PARENT
                }
                allowFullScreen
              />
            </div>
          ))}
        </div>
        <div className="chats" data-open={!!selectedChat}>
          {displayingUsernames.length ? (
            <div>
              <select value={selectedChat} onInput={updateSelectedChat}>
                <option value="">None</option>
                {displayingUsernames.map(username => (
                  <option key={username}>{username}</option>
                ))}
              </select>
              {selectedChat ? <button onClick={togglePoppedOut}>Pop Out</button> : null}
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
