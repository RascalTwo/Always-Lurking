import { Request, Response } from 'express';
import { WebSocket } from 'ws';
import { addOnlineUserToGroup, GROUPS } from './groups';
import { TwitchLookups } from './lookups';

export function getGroups(_: Request, res: Response) {
  return res.send(GROUPS.map(({ clients: _, ...g }) => g));
}

export function handleWS(ws: WebSocket, req: Request) {
  const groupSlugs = (Array.isArray(req.query.group) ? req.query.group : [req.query.group]).filter(Boolean);
  if (!groupSlugs.length) {
    console.log('Attempted WS without group slug');
    ws.send('Group Slug Missing');
    return ws.close();
  }
  const groups = GROUPS.filter(group => groupSlugs.includes(group.slug));
  if (!groups) {
    console.log('Invalid WS Group Slug:', groupSlugs);
    ws.send('Invalid Group Slug');
    return ws.close();
  }
  for (const group of groups) {
    group.clients.push(ws);
    ws.on('close', () => {
      group.clients.splice(group.clients.indexOf(ws), 1);
      console.log(`${group.clients.length}nth ${group.slug} WS Disconnected`);
    });
    console.log(`${group.clients.length}nth ${group.slug} WS Connected`);
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
      let modifiedGroups = [];
      // TODO - return usernames paired with group names and indexes
      if (isOnline) {
        for (const group of GROUPS) {
          if (group.members.includes(username)) {
            addOnlineUserToGroup(group, username);
            modifiedGroups.push(group);
          }
        }
      } else {
        for (const group of GROUPS) {
          const onlineIndex = group.online.indexOf(username);
          if (onlineIndex === -1) {
            console.error(`User was never marked as online`);
            continue;
          }
          group.online.splice(onlineIndex, 1);
          modifiedGroups.push(group);
        }
      }

      for (const group of modifiedGroups) {
        for (const client of group.clients) {
          client.send(JSON.stringify({ event, username }));
        }
      }
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
