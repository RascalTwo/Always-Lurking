import fs from 'fs';
import express from 'express';
import expressWs from 'express-ws';
import { createSubscription, deleteSubscription, getStreams, getSubscriptions, getUsers } from './twitch';
import { GROUPS, loadGroups } from './groups';
import { HOSTNAME, PORT, SUBSCRIPTION_SECRET } from './constants';
import { TwitchLookups } from './lookups';
import router from './routes';

const app = expressWs(express()).app;
app.use(express.json());

app.use(express.static('client/build'));
app.use(router);

(async function startup() {
  console.log('[Startup] Loading groups...');
  await loadGroups();
  console.log(`[Startup] ${GROUPS.length} groups loaded`);

  console.log('[Startup] Loading UID cache...');
  await TwitchLookups.load();
  console.log(`[Startup] ${TwitchLookups.size} UIDs loaded`);

  for (const { slug, members } of GROUPS) console.log(`\t${slug} with ${members.length} members`);

  console.log('[Startup] Populating UID cache...');
  const usernames = [...new Set(GROUPS.flatMap(group => group.members))];
  const missingUIDs = usernames.filter(username => !(username in TwitchLookups.USERNAME_TO_UID));
  if (missingUIDs.length) {
    console.log(`[Startup] ${missingUIDs.length} UIDs missing from ${missingUIDs}`);
    for (const user of (await getUsers({ login: usernames })).data.data) {
      TwitchLookups.update(user.login, user.id);
    }
    await TwitchLookups.save();
  }

  console.log('[Startup] Getting currently online users...');

  const onlineUIDs: string[] = [];

  for (const { user_login, user_id } of (await getStreams({ user_login: usernames })).data.data) {
    onlineUIDs.push(user_id);
    for (const group of GROUPS) {
      if (group.members.includes(user_login)) group.online.push(user_login);
    }
  }

  if (!HOSTNAME) {
    console.log(`[Startup] HOSTNAME missing, ignoring subscriptions`);
  } else {
    const callbackURL = 'https://' + HOSTNAME + '/api/webhook';

    const subs = (await getSubscriptions()).data;
    console.log(`[Startup] Syncing subscriptions...`);

    for (const [i, sub] of [...[...subs.data].entries()].reverse()) {
      let deleteReasons = [''];

      if (!onlineUIDs.includes(sub.condition.broadcaster_user_id)) deleteReasons.push('No longer monitoring user');
      if (!['stream.online', 'stream.offline'].includes(sub.type)) deleteReasons.push('Incorrect subscription type');
      if (!['enabled', 'webhook_callback_verification_pending'].includes(sub.status))
        deleteReasons.push('Subscription failed');
      if (sub.transport.callback !== callbackURL) deleteReasons.push('Outdated Callback URL');

      if (!deleteReasons.length) continue;
      console.log(`[Startup] Deleting ${sub} for ${deleteReasons}`);
      await deleteSubscription(sub.id);
      subs.data.splice(i, 1);
    }

    const needSubscriptions = [
      ...onlineUIDs.map(uid => ({ uid, type: 'stream.online' })),
      ...onlineUIDs.map(uid => ({ uid, type: 'stream.offline' })),
    ].filter(({ uid, type }) => !subs.data.find(sub => sub.condition.broadcaster_user_id === uid && sub.type === type));

    console.log(`[Startup] ${needSubscriptions.length} subscriptions need creation...`);

    for (const { uid, type } of needSubscriptions) {
      await createSubscription({
        version: '1',
        type,
        condition: {
          broadcaster_user_id: uid,
        },
        transport: { callback: callbackURL, method: 'webhook', secret: SUBSCRIPTION_SECRET },
      });
    }
  }

  console.log('[Startup] Starting server...');

  app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
})().catch(console.error);
