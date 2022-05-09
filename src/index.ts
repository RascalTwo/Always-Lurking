import express from 'express';
import expressWs from 'express-ws';
import { PORT } from './constants';

import { GROUPS, loadGroups } from './groups';
import { TwitchLookups } from './lookups';
import setupRoutes from './routes';
import {
  syncUIDCache,
  discoverOnlineUsernames,
  createNeededSubscriptions,
  collectSubscriptionChanges,
  deleteObsoleteSubscriptions,
} from './helpers';

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

  const usernames = [...new Set(GROUPS.flatMap(group => group.members))];
  await syncUIDCache('Startup', ...usernames);

  await discoverOnlineUsernames('Startup', ...usernames);

  const { needed, obsolete } = await collectSubscriptionChanges(
    'Startup',
    ...usernames.map(username => TwitchLookups.USERNAME_TO_UID[username]),
  );
  await deleteObsoleteSubscriptions('Startup', ...obsolete);

  console.log('[Startup] Starting server...');

  app.listen(PORT, async () => {
    console.log(`Listening on port ${PORT}`);

    await createNeededSubscriptions('Startup', ...needed);
  });
})().catch(console.error);
