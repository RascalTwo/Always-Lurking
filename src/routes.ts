import { Application } from 'express-ws';
import Router from 'express-promise-router';
import {
  getGroups,
  handleTwitchEventsub,
  handleWS,
  addGroupMember,
  setGroupMembers,
  removeGroupMember,
  requirePassword,
  getSchedule,
  getProfileIcons
} from './controllers';

export default (app: Application) => {
  const router = Router();

  router.get('/api/schedule', getSchedule);
  router.get('/api/groups', getGroups);
  router.get('/api/profile-icons', getProfileIcons);
  router.put('/api/group/member', requirePassword, addGroupMember);
  router.put('/api/group/members', requirePassword, setGroupMembers);
  router.delete('/api/group/member', requirePassword, removeGroupMember);
  app.use(router);

  app.ws('/api/ws', handleWS);
  router.post('/api/webhook', handleTwitchEventsub);
};
