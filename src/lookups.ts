import fs from 'fs';

const UID_CACHE_PATH = 'cache/uids.json';

export class TwitchLookups {
  public static size = 0;
  public static USERNAME_TO_UID: Record<string, string> = {};
  public static UID_TO_USERNAME: Record<string, string> = {};
  static update(username: string, uid: string) {
    this.USERNAME_TO_UID[username] = uid.toString();
    this.USERNAME_TO_UID[uid] = username;
    this.size++;
  }
  static save() {
    return fs.promises.writeFile(UID_CACHE_PATH, JSON.stringify(TwitchLookups.USERNAME_TO_UID, null, '  '));
  }

  static load() {
    return fs.promises
      .readFile(UID_CACHE_PATH)
      .then(buffer => buffer.toString())
      .then(content => JSON.parse(content))
      .then(data => {
        for (const username in data) {
          const uid = data[username];
          this.USERNAME_TO_UID[username] = uid.toString();
          this.USERNAME_TO_UID[uid] = username;

          this.size++;
        }
      });
  }
}
