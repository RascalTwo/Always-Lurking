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
