import fs from 'fs';
import { getSchedule, getUsers, ScheduleSegment } from './twitch';

const UID_CACHE_PATH = 'cache/uids.json';

export class TwitchLookups {
  public static size = 0;
  public static USERNAME_TO_UID: Record<string, string> = {};
  public static UID_TO_USERNAME: Record<string, string> = {};
  static update(username: string, uid: string) {
    this.USERNAME_TO_UID[username] = uid.toString();
    this.UID_TO_USERNAME[uid] = username;
    this.size++;
  }
  static save() {
    return fs.promises.writeFile(UID_CACHE_PATH, JSON.stringify(TwitchLookups.USERNAME_TO_UID, null, '  '));
  }

  static load() {
    return (fs.existsSync(UID_CACHE_PATH) ? fs.promises.readFile(UID_CACHE_PATH) : Promise.resolve('{}'))
      .then(buffer => buffer.toString())
      .then(content => JSON.parse(content))
      .then(data => {
        for (const username in data) {
          const uid = data[username];
          this.USERNAME_TO_UID[username] = uid.toString();
          this.UID_TO_USERNAME[uid] = username;

          this.size++;
        }
      });
  }
}

const SCHEDULE_CACHE_PATH = 'cache/schedules.json';

export class ScheduleLookups {
  public static TTL = 86400000;
  public static CACHE: Record<string, { cached: number; segments: ScheduleSegment[] }> = {};
  static async get(...uids: string[]) {
    const now = Date.now();
    const results: Record<string, ScheduleSegment[]> = {};
    for (const uid of uids) {
      const timeCached = now - (this.CACHE[uid]?.cached || 0);
      if (timeCached >= this.TTL)
      {
        const response = await getSchedule({ broadcaster_id: uid }).catch(err => err.response);
        this.CACHE[uid] = {
          cached: now,
          segments: response.data.data?.segments || [],
        };
      }

      results[uid] = this.CACHE[uid].segments;
    }
    await this.save();
    return results;
  }
  static async save() {
    return fs.promises.writeFile(SCHEDULE_CACHE_PATH, JSON.stringify(this.CACHE, undefined, '  '));
  }

  static load() {
    return (fs.existsSync(SCHEDULE_CACHE_PATH) ? fs.promises.readFile(SCHEDULE_CACHE_PATH) : Promise.resolve('[]'))
      .then(buffer => buffer.toString())
      .then(content => JSON.parse(content))
      .then(data => (ScheduleLookups.CACHE = data));
  }
}


const PROFILE_ICON_CACHE_PATH = 'cache/profile-icons.json';

export class ProfileIconLookups {
  public static TTL = 86400000 * 7;
  public static CACHE: Record<string, { cached: number; url: string }> = {};
  static async get(...uids: string[]) {
    const now = Date.now();
    const expiredUIDs = uids.filter(uid => now - (this.CACHE[uid]?.cached || 0) >= this.TTL);
    for (let i = 0; i < expiredUIDs.length; i += 50) {
      for (const user of (await getUsers({ id: expiredUIDs.slice(i, i + 50) })).data.data) {
        TwitchLookups.update(user.login, user.id.toString());
        this.CACHE[user.id] = {
          cached: now,
          url: user.profile_image_url,
        };
      }
    }

    await this.save();

    const results: Record<string, string> = {};
    for (const uid of uids) results[uid] = this.CACHE[uid].url;
    return results;
  }
  static async save() {
    return fs.promises.writeFile(PROFILE_ICON_CACHE_PATH, JSON.stringify(this.CACHE, undefined, '  '));
  }

  static load() {
    return (fs.existsSync(PROFILE_ICON_CACHE_PATH) ? fs.promises.readFile(PROFILE_ICON_CACHE_PATH) : Promise.resolve('[]'))
      .then(buffer => buffer.toString())
      .then(content => JSON.parse(content))
      .then(data => (ProfileIconLookups.CACHE = data));
  }
}
