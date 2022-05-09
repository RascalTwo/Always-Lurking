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
  app.get('/api/groups', getGroups);
  app.put('/api/group/member', requirePassword, addGroupMember);
  app.put('/api/group/members', requirePassword, setGroupMembers);
  app.delete('/api/group/member', requirePassword, removeGroupMember);
  app.ws('/api/ws', handleWS);
  app.post('/api/webhook', handleTwitchEventsub);
};
