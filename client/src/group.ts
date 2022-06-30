import { GroupPayload } from "./types";

export class Group {
  name: string;
  slug: string;
  members: string[];
  online: { started: number, username: string}[];
  constructor(name: string, slug: string, members: string[], online: { started: number, username: string}[]) {
    this.name = name;
    this.slug = slug;
    this.members = members;
    this.online = online;
  }
  static from({ name, slug, members, online }: GroupPayload) {
    return new Group(name, slug, members, online);
  }

  _sortOnlineUsernames() {
    this.online.sort((a, b) => this.members.indexOf(a.username) - this.members.indexOf(b.username));
    return this;
  }

  addOnlineUsername(username: string, started: number) {
    if (!this.members.includes(username) || this.online.find(online => online.username === username)) return this;

    this.online.push({ started, username });
    return this._sortOnlineUsernames();
  }

  removeOnlineUsername(username: string) {
    const index = this.online.findIndex(online => online.username === username);
    if (index === -1) return this;
    this.online.splice(index, 1);
    return this;
  }

  setOnline(online: { started: number, username: string}[]) {
    this.online = online;

    return this._sortOnlineUsernames();
  }
}
