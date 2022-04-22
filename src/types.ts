import { WebSocket } from 'ws';

export interface GroupInfo {
  name: string;
  slug: string;
  members: string[];
	online: string[]
}

export interface Group extends GroupInfo {
  clients: WebSocket[];
}
