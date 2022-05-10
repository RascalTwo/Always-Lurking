import fs from 'fs';
import type { Group, GroupInfo } from './types';

export const GROUPS: Group[] = [];

export async function loadGroups() {
  GROUPS.push(
    ...(fs.existsSync('groups.json') ? JSON.parse((await fs.promises.readFile('groups.json')).toString()) : []).map(
      (info: GroupInfo) => ({
        ...info,
        members: info.members.map(member => member.trim().toLowerCase()),
        clients: [],
        online: [],
      }),
    ),
  );
}

export async function saveGroups(groups: Group[]) {
  return fs.promises.writeFile(
    'groups.json',
    JSON.stringify(
      groups.map(({ slug, name, members }) => ({ slug, name, members })),
      undefined,
      '  ',
    ),
  );
}

export function markUserOnline(group: Group, username: string) {
  if (!group.members.includes(username))
    return console.error(`Tried to mark ${username} online in ${group.slug} where they are not a member`);

  group.online.push(username);
  group.online.sort((a, b) => group.members.indexOf(a) - group.members.indexOf(b));
  for (const client of group.clients) {
    client.send(JSON.stringify({ event: 'online', username }));
  }
}

export function markUserOffline(group: Group, username: string) {
  if (group.members.includes(username))
    return console.error(`Tried to mark ${username} offline in ${group.slug}, but they are not a member`);

  const onlineIndex = group.online.indexOf(username);
  if (onlineIndex === -1)
    return console.error(`Tried to mark ${username} as offline in ${group.slug} before they were online`);

  group.online.splice(onlineIndex, 1);
  for (const client of group.clients) {
    client.send(JSON.stringify({ event: 'offline', username }));
  }
}
