import express from 'express';
import expressWs from 'express-ws';
import { createSubscription, deleteSubscription, getStreams, getSubscriptions, getUsers, Subscription } from './twitch';
import { GROUPS, loadGroups } from './groups';
import { HOSTNAME, PORT, SUBSCRIPTION_SECRET } from './constants';
import { TwitchLookups } from './lookups';
import setupRoutes from './routes';

const app = expressWs(express()).app;
app.use(express.json());

app.use(express.static('client/build'));
setupRoutes(app);

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
      TwitchLookups.update(user.login, user.id.toString());
    }
    await TwitchLookups.save();
  }

  const uids = usernames.map(username => TwitchLookups.USERNAME_TO_UID[username]);

  console.log('[Startup] Getting currently online users...');

  const onlineUIDs: string[] = [];

  for (const { user_login, user_id } of (await getStreams({ user_login: usernames })).data.data) {
    onlineUIDs.push(user_id);
    for (const group of GROUPS) {
      if (group.members.includes(user_login)) group.online.push(user_login);
    }
  }

  console.log(
    '[Startup] Online users:',
    onlineUIDs.map(uid => TwitchLookups.UID_TO_USERNAME[uid]),
  );

  const callbackURL = 'https://' + HOSTNAME + '/api/webhook';
  const subs: Subscription[] = [];

  const needSubscriptions: { uid: string; type: string }[] = [];

  if (!HOSTNAME) {
    console.log(`[Startup] HOSTNAME missing, ignoring subscriptions`);
  } else {
    console.log(`[Startup] Checking subscriptions...`);
    subs.push(...(await getSubscriptions()).data.data);

    for (const [i, sub] of [...subs.entries()].reverse()) {
      let deleteReasons = [];

      if (!uids.includes(sub.condition.broadcaster_user_id)) deleteReasons.push('No longer monitoring user');
      if (!['stream.online', 'stream.offline'].includes(sub.type)) deleteReasons.push('Incorrect subscription type');
      if (!['enabled', 'webhook_callback_verification_pending'].includes(sub.status))
        deleteReasons.push('Subscription failed');
      if (sub.transport.callback !== callbackURL) deleteReasons.push('Outdated Callback URL');

      if (!deleteReasons.length) continue;
      console.log(`[Startup] Deleting ${JSON.stringify(sub)} for ${deleteReasons.join(', ')}`);
      await deleteSubscription(sub.id);
      subs.splice(i, 1);
    }
    needSubscriptions.push(
      ...[
        ...uids.map(uid => ({ uid, type: 'stream.online' })),
        ...uids.map(uid => ({ uid, type: 'stream.offline' })),
      ].filter(({ uid, type }) => !subs.find(sub => sub.condition.broadcaster_user_id === uid && sub.type === type)),
    );

    console.log(`[Startup] ${needSubscriptions.length} subscriptions need creation...`);
  }

  console.log('[Startup] Starting server...');

  app.listen(PORT, async () => {
    console.log(`Listening on port ${PORT}`);

    if (!HOSTNAME) return;

    for (const { uid, type } of needSubscriptions) {
      console.log(`[Startup] ${TwitchLookups.UID_TO_USERNAME[uid]} (${uid}) ${type}`);
      await createSubscription({
        version: '1',
        type,
        condition: {
          broadcaster_user_id: uid.toString(),
        },
        transport: { callback: callbackURL, method: 'webhook', secret: SUBSCRIPTION_SECRET },
      });
    }
  });
})().catch(console.error);
