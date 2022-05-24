import { HOSTNAME, CALLBACK_URL, SUBSCRIPTION_SECRET } from './constants';
import { GROUPS, markUserOnline } from './groups';
import { TwitchLookups } from './lookups';
import {
  getUsers,
  paginageResults,
  getStreams,
  Subscription,
  getSubscriptions,
  deleteSubscription,
  createSubscription,
} from './twitch';
import type { NeededSubscription, ObsoleteSubscription } from './types';

export function outputGroupStates(label: string) {
  console.log(`[${label}] Online users:`, new Set(GROUPS.flatMap(group => group.online)).size);
  for (const group of GROUPS) console.log(`[${label}] ${group.slug} Members Online:`, group.online);
}

export async function syncUIDCache(label: string, ...usernames: string[]) {
  console.log(`[${label}] Populating UID cache...`);
  const missingUIDs = usernames.filter(username => !(username in TwitchLookups.USERNAME_TO_UID));
  if (missingUIDs.length) {
    console.log(`[${label}] ${missingUIDs.length} UIDs missing from ${missingUIDs}`);
    for (let i = 0; i < usernames.length; i += 50) {
      for (const user of (await getUsers({ login: usernames.slice(i, i + 50) })).data.data) {
        TwitchLookups.update(user.login, user.id.toString());
      }
    }
    await TwitchLookups.save();
  }
  console.log(`[${label}] UID cache populated`);
}

export async function discoverOnlineUsernames(label: string, ...usernames: string[]) {
  console.log(`[${label}] Getting currently online users...`);

  const onlineUsernames: string[] = [];

  for (let i = 0; i < usernames.length; i += 50) {
    for (const { data } of await paginageResults(await getStreams({ user_login: usernames.slice(i, i + 50) }))) {
      for (const { user_login } of data) {
        onlineUsernames.push(user_login);
        for (const group of GROUPS) {
          if (group.members.includes(user_login)) markUserOnline(group, user_login);
        }
      }
    }
  }
}

export async function collectSubscriptionChanges(label: string, ...uids: string[]) {
  const obsolete: ObsoleteSubscription[] = [];
  const needed: NeededSubscription[] = [];

  if (!HOSTNAME) {
    console.log(`[${label}] HOSTNAME missing, ignoring subscriptions`);
  } else {
    console.log(`[${label}] Checking subscriptions...`);

    const subs: Subscription[] = [];
    for (const { data } of await paginageResults(await getSubscriptions())) {
      subs.push(...data);
    }

    for (const [i, sub] of [...subs.entries()].reverse()) {
      let deleteReasons = [];

      if (!uids.includes(sub.condition.broadcaster_user_id)) deleteReasons.push('No longer monitoring user');
      if (!['stream.online', 'stream.offline'].includes(sub.type)) deleteReasons.push('Incorrect subscription type');
      if (!['enabled', 'webhook_callback_verification_pending'].includes(sub.status))
        deleteReasons.push('Subscription failed');
      if (sub.transport.callback !== CALLBACK_URL) deleteReasons.push('Outdated Callback URL');

      if (deleteReasons.length) obsolete.push({ subscription: sub, reasons: deleteReasons });
    }
    needed.push(
      ...[
        ...uids.map(uid => ({ uid, type: 'stream.online' })),
        ...uids.map(uid => ({ uid, type: 'stream.offline' })),
      ].filter(({ uid, type }) => !subs.find(sub => sub.condition.broadcaster_user_id === uid && sub.type === type)),
    );

    console.log(`[${label}] ${needed.length} subscriptions need creation...`);
    console.log(`[${label}] ${obsolete.length} obsolete subscriptions need deletion...`);
  }

  return {
    obsolete,
    needed,
  };
}

export async function createNeededSubscriptions(label: string, ...neededSubscriptions: NeededSubscription[]) {
  if (!HOSTNAME) return;

  for (const { uid, type } of neededSubscriptions) {
    console.log(`[${label}] ${TwitchLookups.UID_TO_USERNAME[uid]} (${uid}) ${type}`);
    await createSubscription({
      version: '1',
      type,
      condition: {
        broadcaster_user_id: uid.toString(),
      },
      transport: { callback: CALLBACK_URL, method: 'webhook', secret: SUBSCRIPTION_SECRET },
    });
  }
}

export async function deleteObsoleteSubscriptions(label: string, ...obsoleteSubscriptions: ObsoleteSubscription[]) {
  for (const { subscription, reasons } of obsoleteSubscriptions) {
    console.log(`[${label}] Deleting ${JSON.stringify(subscription)} for ${reasons.join(', ')}`);
    await deleteSubscription(subscription.id);
  }
}
