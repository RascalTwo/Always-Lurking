import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Schedule.module.css';

function getWeekNumber(currentdate: Date) {
  var oneJan = new Date(currentdate.getFullYear(), 0, 1);
  var numberOfDays = Math.floor((currentdate.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  var result = Math.ceil((currentdate.getDay() + 1 + numberOfDays) / 7);
  return result;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat'];

function dateToYYYYMMDD(date: Date) {
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date
    .getUTCDate()
    .toString()
    .padStart(2, '0')}`;
}

export default function Schedule({ usernames }: { usernames: string[] }) {
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
  const [startDate, setStartDate] = useState(() => {
    const current = new Date();
    current.setUTCHours(0);
    current.setUTCMinutes(0);
    current.setUTCSeconds(0);
    current.setUTCMilliseconds(0);
    while (current.getUTCDay() !== 1) current.setUTCDate(current.getUTCDate() - 1);
    return current;
  });
  const endDate = useMemo(() => {
    const end = new Date(startDate);
    end.setUTCDate(startDate.getUTCDate() + 7);
    return end;
  }, [startDate]);
  useEffect(() => {
    const url = new URL('/api/schedule', window.location.origin);
    for (const username of usernames) url.searchParams.append('usernames', username);
    url.searchParams.set('start', startDate.getTime().toString());

    fetch(url.toString())
      .then(r => r.json())
      .then(setData);
  }, [usernames, startDate]);

  const [inputDate, setInputDate] = useState(dateToYYYYMMDD(new Date()));

  const todayEvents = useMemo(() => events.filter(e => e.start_time.includes(inputDate)), [events, inputDate]);

  const changeDay = useCallback(
    amount => {
      const date = new Date(inputDate);
      date.setUTCDate(date.getUTCDate() + amount);
      setInputDate(dateToYYYYMMDD(date));
    },
    [inputDate],
  );

  return (
    <fieldset className={styles.fieldset}>
      <legend>Schedule</legend>
      <div>
        <button onClick={changeDay.bind(null, -1)}>Previous</button>
        <input type="date" value={inputDate} onChange={e => setInputDate(e.currentTarget.value)} />
        <button onClick={changeDay.bind(null, 1)}>Next</button>
      </div>
      <ul>
        {todayEvents.map(event => (
          <li key={event.username + '-' + event.start_time}>
            <span>
              {new Date(event.start_time).toLocaleTimeString()} to {new Date(event.end_time).toLocaleTimeString()}
            </span>
            - {event.title} - <span>{event.username}</span>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
