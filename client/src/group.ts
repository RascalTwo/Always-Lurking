import { GroupPayload } from "./types";

export class Group {
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
