import { NextFunction, Request, Response } from 'express';
import { WebSocket } from 'ws';
import { MODIFY_PASSWORD } from './constants';
import { GROUPS, markUserOffline, markUserOnline, saveGroups } from './groups';
import {
  collectSubscriptionChanges,
  createNeededSubscriptions,
  deleteObsoleteSubscriptions,
  discoverOnlineUsernames,
  outputGroupStates,
  syncUIDCache,
} from './helpers';
import { ProfileIconLookups, ScheduleLookups, TwitchLookups } from './lookups';

function getGroupsBySlugs(...slugs: string[]) {
  return GROUPS.filter(group => slugs.includes(group.slug));
}

export function requirePassword(req: Request, res: Response, next: NextFunction) {
  if (!MODIFY_PASSWORD) return res.send(403).send('Modification not enabled');
  if (req.query.password !== MODIFY_PASSWORD) return res.status(403).send('Invalid password');
  return next();
}

export function getGroups(_: Request, res: Response) {
  return res.send(GROUPS.map(({ clients: _, ...g }) => g));
}

export async function addGroupMember(req: Request, res: Response) {
  const groupSlug = req.query.group as string;
  const username = ((req.query.username as string) || '').toLowerCase();
  if (!groupSlug || !username) return res.status(400).send('Missing group and username');

  const group = getGroupsBySlugs(groupSlug)[0];
  if (!group) return res.status(400).send('Invalid Group Slug: ' + groupSlug);

  const index = +(req.query.index || group.members.length);
  if (group.members.includes(username)) return res.status(200).end();

  group.members.splice(index, 0, username);
  await saveGroups(GROUPS);

  await syncUIDCache('Add Group Member', username);
  await discoverOnlineUsernames('Add Group Member', username);
  const { needed } = await collectSubscriptionChanges('Add Group Member', TwitchLookups.USERNAME_TO_UID[username]);
  await createNeededSubscriptions('Add Group Member', ...needed);

  return res.status(200).end();
}

export async function removeGroupMember(req: Request, res: Response) {
  const groupSlug = req.query.group as string;
  const username = ((req.query.username as string) || '').toLowerCase();
  if (!groupSlug || !username) return res.status(400).send('Missing group and username');

  const group = getGroupsBySlugs(groupSlug)[0];
  if (!group) return res.status(400).send('Invalid Group Slug: ' + groupSlug);

  const memberIndex = group.members.indexOf(username);
  if (memberIndex === -1) return res.status(200).end();

  group.members.splice(memberIndex, 1);
  await saveGroups(GROUPS);

  for (const group of GROUPS.filter(group => group.online.find(online => online.username === username))) {
    markUserOffline(group, username);
  }

  const { obsolete } = await collectSubscriptionChanges('Remove Group Member', TwitchLookups.USERNAME_TO_UID[username]);
  await deleteObsoleteSubscriptions('Remove Group Member', ...obsolete);

  return res.status(200).end();
}

export async function setGroupMembers(req: Request, res: Response) {
  const groupSlug = req.query.group as string;
  const members = (Array.isArray(req.query.members) ? req.query.members : [req.query.members]).filter(
    Boolean,
  ) as string[];
  if (!members.length) return res.status(400).send('Missing members');

  const group = getGroupsBySlugs(groupSlug)[0];
  if (!group) return res.status(400).send('Invalid Group Slug: ' + groupSlug);

  group.members = members;
  const goingOffline = group.online.filter(online => !group.members.includes(online.username));
  for (const { username } of goingOffline) {
    markUserOffline(group, username);
  }

  const { needed, obsolete } = await collectSubscriptionChanges(
    'Set Group Members',
    ...goingOffline.map(online => online.username).concat(group.members).map(username => TwitchLookups.USERNAME_TO_UID[username]),
  );
  await createNeededSubscriptions('Set Group Members', ...needed);
  await deleteObsoleteSubscriptions('Set Group Members', ...obsolete);

  return res.status(200).end();
}

export function handleWS(ws: WebSocket, req: Request) {
  const groupSlugs = (Array.isArray(req.query.group) ? req.query.group : [req.query.group]).filter(Boolean) as string[];
  if (!groupSlugs.length) {
    console.log('Attempted WS without group slug');
    ws.send('Group Slug Missing');
    return ws.close();
  }
  const groups = getGroupsBySlugs(...groupSlugs);
  if (!groups) {
    console.log('Invalid WS Group Slug:', groupSlugs);
    ws.send('Invalid Group Slug');
    return ws.close();
  }
  for (const [i, group] of groups.entries()) {
    group.clients.push(ws);
    ws.on('close', () => {
      group.clients.splice(group.clients.indexOf(ws), 1);
      console.log(`${group.clients.length}nth ${group.slug} WS Disconnected`);
    });
    console.log(`${group.clients.length}nth ${group.slug} WS Connected`);

    setTimeout(
      group => ws.send(JSON.stringify({ event: 'sync', group: group.slug, online: group.online })),
      i * 1000,
      group,
    );
  }
}

export function handleTwitchEventsub(req: Request, res: Response) {
  console.log('\t[Twitch Eventsub]');

  const notificationType = req.header('Twitch-Eventsub-Message-Type');
  switch (notificationType) {
    case 'notification':
      const isOnline = req.body.subscription.type === 'stream.online';
      const event = isOnline ? 'online' : 'offline';
      const uid = req.body.event.broadcaster_user_id;
      const username = TwitchLookups.UID_TO_USERNAME[uid];
      console.log(`${username} (${uid}) has went ${event} `);
      if (isOnline) {
        for (const group of GROUPS) {
          if (group.members.includes(username)) markUserOnline(group, username, new Date(req.body.event.started_at).getTime());
        }
      } else {
        for (const group of GROUPS) {
          if (group.members.includes(username)) markUserOffline(group, username);
        }
      }

      outputGroupStates('Twitch Eventsub Notification');

      return res.status(204).end();
    case 'webhook_callback_verification':
      console.log('Verification request received', req.body);
      return res.status(200).send(req.body.challenge);
    case 'revocation':
      console.log('Revocation', req.body);
      return res.status(204).end();
    default:
      console.error('Unexpected notification type:', notificationType, req.body);
      return res.status(400).end();
  }
}

export async function getSchedule(req: Request, res: Response) {
  const usernames = Array.isArray(req.query.usernames)
    ? (req.query.usernames as string[])
    : ([req.query.usernames] as string[]);

  await syncUIDCache('Schedule Request', ...usernames);

  const uidMapping = await ScheduleLookups.get(
    ...usernames.map((username: string) => TwitchLookups.USERNAME_TO_UID[username]).filter(Boolean),
  );
  return res.json(
    Object.fromEntries(
      Object.entries(uidMapping).map(([uid, segments]) => [TwitchLookups.UID_TO_USERNAME[uid], segments]),
    ),
  );
}

export async function getProfileIcons(req: Request, res: Response) {
  const usernames = Array.isArray(req.query.usernames)
    ? (req.query.usernames as string[])
    : ([req.query.usernames] as string[]);

  await syncUIDCache('Profile Icons', ...usernames);

  const uidMapping = await ProfileIconLookups.get(
    ...usernames.map((username: string) => TwitchLookups.USERNAME_TO_UID[username]).filter(Boolean),
  );
  const results = Object.fromEntries(
    Object.entries(uidMapping).map(([uid, url]) => [TwitchLookups.UID_TO_USERNAME[uid], url]),
  )
  for (const username of usernames) {
    if (!results[username]) results[username] = '';
  }
  return res.json(results);
}