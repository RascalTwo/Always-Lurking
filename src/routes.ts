import { Application } from 'express-ws';
import { getGroups, handleTwitchEventsub, handleWS } from './controllers';

export default (app: Application) => {
  app.get('/api/groups', getGroups);
  app.ws('/api/ws', handleWS);
  app.post('/api/webhook', handleTwitchEventsub);
};
