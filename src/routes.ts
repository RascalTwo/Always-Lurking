import { Application } from 'express-ws';
import {
  getGroups,
  handleTwitchEventsub,
  handleWS,
  addGroupMember,
  setGroupMembers,
  removeGroupMember,
  requirePassword,
} from './controllers';

export default (app: Application) => {
  app.get('/api/schedule', getSchedule);
  app.ws('/api/ws', handleWS);
  app.post('/api/webhook', handleTwitchEventsub);
};
