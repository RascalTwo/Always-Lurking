import { WebSocket } from 'ws';
import { Subscription } from './twitch';

export interface GroupInfo {
  name: string;
  slug: string;
  members: string[];
	online: string[]
}

export interface Group extends GroupInfo {
  clients: WebSocket[];
}

export interface NeededSubscription {
  uid: string;
  type: string;
}

export interface ObsoleteSubscription {
  subscription: Subscription;
  reasons: string[];
}