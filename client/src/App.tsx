import './App.css';
import React, { useState, useEffect, useMemo, useCallback, useDebugValue, useRef, CSSProperties } from 'react';
import Joyride, { ACTIONS, CallBackProps } from 'react-joyride';

import 'react-checkbox-tree/lib/react-checkbox-tree.css';
import CheckboxTree from 'react-checkbox-tree';

import tmi from 'tmi.js';

import { TWITCH_PARENT } from './constants';
import { useGroups, useGroupWebsocket, useHashedCSA, useHashState, usePlayerWindows } from './hooks';
import { Group } from './group';
import Schedule from './Schedule';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  profileIcons: Record<string, string>,
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
  const onlineUsernames = useMemo(() => [...new Set(groups.flatMap(group => group.online))], [groups]);

  const treeNodes = useMemo(
    () =>
      groups.map(group => ({
        value: group.slug,
        label: `${group.name} - (${group.online.length}/${group.members.length})`,
        title: `${group.name} - ${group.online.length} of ${group.members.length} currently online`,
        className: 'r2-group',
        children: group.members.map(member => {
          const started = onlineUsernames.find(online => online.username === member)?.started || null;
          return {
            icon: <img className="r2-icon" src={profileIcons[member] || ''} />,
            value: JSON.stringify([group.slug, member]),
            label: (
              <span>
                {member}{' '}
                {started ? (
                  <>
                    - <UptimeTicker started={started} />
                  </>
                ) : null}
              </span>
            ),
            className: `rct-username-o${group.online.find(online => online.username === member) ? 'n' : 'ff'}line`,
          };
        }),
      })),
    [groups, onlineUsernames],
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

const useProfileIcons = (usernames: string[]) => {
  const [profileIcons, setProfileIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    const missingUsernames = usernames.filter(username => !(username in profileIcons));
    if (!missingUsernames.length) return;

    let mounted = true;

    const url = new URL('/api/profile-icons', window.location.origin);
    for (const username of missingUsernames) url.searchParams.append('usernames', username);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (mounted) setProfileIcons({ ...profileIcons, ...data });
      });

    return () => {
      mounted = false;
    };
  }, [profileIcons, usernames]);

  return profileIcons;
};

const useGroupSelector = () => {
  const [groups, updateGroups] = useGroups();

  const [selectedGroupSlugs, selectGroups] = useState<string[]>([]);
  const selectedGroups = useMemo(
    () => groups.filter(group => selectedGroupSlugs.includes(group.slug)),
    [selectedGroupSlugs, groups],
  );
  const [additionalUsernames, AdditionalUsernamesElement] = useAdditionalUsernames();

  const profileIcons = useProfileIcons(
    useMemo(() => [...additionalUsernames, ...groups.flatMap(group => group.members)], [additionalUsernames, groups]),
  );
  const [selectedUsernames, CheckboxTreeElement] = useCheckboxTree(groups, selectGroups, profileIcons);

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
    profileIcons,
    GroupSelectorElement,
    connectionStatus: useGroupWebsocket(selectedGroupSlugs, updateGroups),
  };
};

function GenericToggleableDetails({
  defaultOpen = true,
  text,
  className,
  children,
}: {
  defaultOpen?: boolean;
  text: string;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={className} open={open} onToggle={useCallback(e => setOpen(e.currentTarget.open), [])}>
      <summary>{text}</summary>
      <fieldset>
        <legend>
          <button onClick={useCallback(() => setOpen(open => !open), [])}>▼ {text}</button>
        </legend>
        {children}
      </fieldset>
    </details>
  );
}

function MainToggleableDetails({
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
    <details className="main-controls" open={open} onToggle={useCallback(e => setOpen(e.currentTarget.open), [])}>
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

function UptimeTicker({ started }: { started: number | null }) {
  const [elapsed, setElapsed] = useState(() => (started ? Date.now() - started : 0));
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setElapsed(elapsed => elapsed + 1000), 1000);
    return () => clearInterval(interval);
  }, [started]);

  if (!started) return null;

  return (
    <time dateTime={new Date(started).toISOString()} className="uptime">
      {new Date(elapsed).toISOString().substr(11, 8)}
    </time>
  );
}

function App() {
  const {
    selectedUsernames,
    selectedGroups,
    additionalUsernames,
    GroupSelectorElement,
    connectionStatus,
    profileIcons,
  } = useGroupSelector();

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

  const [missedMessages, setMissedMessages] = useState<Record<string, number>>({});

  // TODO - dont use state for this
  const [tmiInstance, setTMIInstance] = useState<tmi.Client | null>(() => {
    const instance = new tmi.Client({ options: { skipMembership: true, skipUpdatingEmotesets: true, debug: true } });
    instance.connect();
    return instance;
  });

  if (selectedChat in missedMessages)
    setMissedMessages(missed => {
      const newMissed = { ...missed };
      delete newMissed[selectedChat];
      return newMissed;
    });

  useEffect(() => {
    if (!tmiInstance) return;

    tmiInstance.on('chat', (channel, userstate, message, self) => {
      if (self) return;
      if (channel === selectedChat) return;
      setMissedMessages(missed => ({
        ...missed,
        [channel.slice(1)]: (missed[channel.slice(1)] || 0) + 1,
      }));
    });

    let mounted = true;
    (async () => {
      const joinedChannels = tmiInstance.getChannels().map(channel => channel.slice(1));
      for (const joinedChannel of joinedChannels) {
        if (!displayingUsernames.includes(joinedChannel)) {
          await delay(2000);
          if (!mounted) return;
          tmiInstance.part(joinedChannel);
        }
      }
      for (const username of displayingUsernames) {
        if (!joinedChannels.includes(username)) {
          await delay(2000);
          if (!mounted) return;
          tmiInstance.join(username);
        }
      }
    })();
    return () => {
      mounted = false;
      tmiInstance.removeAllListeners('chat');
    };
  }, [tmiInstance, selectedChat, displayingUsernames]);

  return (
    <>
      {JoyrideElement}
      {schedule ? <Schedule usernames={requestedUsernames} /> : null}
      <MainToggleableDetails defaultOpen={!selectedGroups.length} connectionStatus={connectionStatus}>
        {GroupSelectorElement}
        <div>
          {PopoutElement}
          {AutoplayElement}
          <button onClick={toggleJoyride}>Help</button>
          <button onClick={useCallback(() => setSchedule(schedule => !schedule), [setSchedule])}>
            {schedule ? 'Hide' : 'Show'} Schedule
          </button>
        </div>
      </MainToggleableDetails>
      <section className="content">
        <div className="players" data-count={players.length}>
          {players.map((username, i) => (
            <div className="player-wrapper" style={{ gridArea: String.fromCharCode(97 + i) }} key={username}>
              <UptimeTicker started={onlineUsernames.find(online => online.username === username)?.started || null} />
              <iframe
                title={username}
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
            <GenericToggleableDetails text="Chat" defaultOpen={true} className="chat-controls">
              <div>
                <select value={selectedChat} onInput={updateSelectedChat}>
                  <option value="">None</option>
                  {displayingUsernames.map(username => (
                    <option key={username}>{username}</option>
                  ))}
                </select>
                {selectedChat ? <button onClick={togglePoppedOut}>Pop Out</button> : null}
              </div>
              <ul>
                {[...displayingUsernames].map(username => (
                  <li
                    key={username}
                    data-selected={selectedChat === username}
                    data-has-count={!!missedMessages[username]}
                    className="channel-chat-circle"
                  >
                    <button
                      onClick={() => setSelectedChat(username)}
                      title={username}
                      style={{ '--background-image': 'url(' + profileIcons[username] + ')' } as CSSProperties}
                      key={missedMessages[username]}
                    >
                      {missedMessages[username] ? <span>{missedMessages[username]}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </GenericToggleableDetails>
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
