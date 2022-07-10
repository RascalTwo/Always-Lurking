import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Schedule.module.css';
import { useEpg, Epg, Layout } from 'planby';
import { Channel, Program } from 'planby/dist/Epg/helpers/interfaces';
import GenericToggleableDetails from './TogglableDetails';

function dateToYYYYMMDD(date: Date) {
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date
    .getUTCDate()
    .toString()
    .padStart(2, '0')}`;
}

export default function Schedule({
  usernames,
  profileIcons,
}: {
  usernames: string[];
  profileIcons: Record<string, string>;
}) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const events = useMemo(
    () =>
      Object.entries(data)
        .reduce(
          (allSegments, [username, segments]) => [
            ...allSegments,
            ...segments.map(segment => ({ ...segment, username })),
          ],
          [] as any[],
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [data],
  );

  useEffect(() => {
    const startDate = new Date();
    startDate.setUTCHours(0);
    startDate.setUTCMinutes(0);
    startDate.setUTCSeconds(0);
    startDate.setUTCMilliseconds(0);
    while (startDate.getUTCDay() !== 1) startDate.setUTCDate(startDate.getUTCDate() - 1);

    const url = new URL('/api/schedule', window.location.origin);
    for (const username of usernames) url.searchParams.append('usernames', username);
    url.searchParams.set('start', startDate.getTime().toString());

    fetch(url.toString())
      .then(r => r.json())
      .then(setData);
  }, [usernames]);

  const [inputDate, setInputDate] = useState(dateToYYYYMMDD(new Date()));

  const changeDay = useCallback(
    amount => {
      const date = new Date(inputDate);
      date.setUTCDate(date.getUTCDate() + amount);
      setInputDate(dateToYYYYMMDD(date));
    },
    [inputDate],
  );

  const channels: Channel[] = useMemo(
    () =>
      Object.keys(data)
        .map(username => ({
          uuid: username,
          logo: profileIcons[username],
        }))
        .filter(channel =>
          events.some(event => {
            const [y, m, d] = inputDate.split('-').map(Number);
            return (
              event.username === channel.uuid &&
              Math.abs(new Date(event.start_time).getTime() - new Date(y, m - 1, d).getTime()) <= 86400000
            );
          }),
        ),
    [data, profileIcons, events, inputDate],
  );

  const epg: Program[] = useMemo(() => {
    return events.map(e => ({
      channelUuid: e.username,
      description: 'Desc',
      id: e.id,
      image: 'https://via.placeholder.com/350x150',
      since: (() => {
        const start = new Date(e.start_time);
        return start.toISOString();
      })(),
      till: (() => {
        if (e.end_time) {
          const end = new Date(e.end_time);
          return end.toISOString();
        }
        const end = new Date(e.start_time);
        end.setHours(end.getHours() + 4);
        return end.toISOString();
      })(),
      title: e.title,
    }));
  }, [events]);

  const { getEpgProps, getLayoutProps } = useEpg({
    epg,
    channels,
    startDate: `${inputDate}T00:00:00`,
    endDate: `${inputDate}T24:00:00`,
    width: window.innerWidth * 0.9,
    height: 600,
    isBaseTimeFormat: true,
    dayWidth: 24 * 150
  });

  return (
    <GenericToggleableDetails text="Schedule" defaultOpen={true} className={styles.fieldset}>
      <>
        <div>
          <button onClick={changeDay.bind(null, -1)}>Previous</button>
          <input type="date" value={inputDate} onChange={e => setInputDate(e.currentTarget.value)} />
          <button onClick={changeDay.bind(null, 1)}>Next</button>
        </div>

        <Epg {...getEpgProps()}>
          <Layout {...getLayoutProps()} />
        </Epg>
      </>
    </GenericToggleableDetails>
  );
}
