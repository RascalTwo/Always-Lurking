import axios, { AxiosResponse } from 'axios';
import url from 'url';

require('dotenv').config();

const URL = 'https://api.twitch.tv/helix' || 'http://localhost:8080/mock';
const BACKEND_URL = 'https://db5d-76-190-221-237.ngrok.io/';

const HEADERS = {
  'Client-Id': process.env.TWITCH_CLIENT_ID!,
  Authorization: `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`!,
};

/**
 * {@link https://dev.twitch.tv/docs/api/reference#delete-eventsub-subscription Twitch Docs}
 */
export function deleteSubscription(id: string) {
  return axios.delete<any, AxiosResponse<void, any>>(`${URL}/eventsub/subscriptions`, {
    headers: HEADERS,
    params: { id },
  });
}

type SubscriptionStatus =
  | 'enabled'
  | 'webhook_callback_verification_pending'
  | 'webhook_callback_verification_failed'
  | 'notification_failures_exceeded'
  | 'authorization_revoked'
  | 'user_removed';

type Pagination = {} | { cursor: string };
interface GetSubscriptionParams {
  status?: SubscriptionStatus;
  type?: string;
  after?: string;
}

interface SubscriptionsResponse {
  total: number;
  total_cost: number;
  max_total_cost: number;
  pagination: Pagination;
  data: Subscription[];
}

interface SubscriptionTransport {
  method: 'webhook';
  callback: string;
  secret: string;
}

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  type: string;
  version: string;
  condition: any;
  created_at: string;
  transport: SubscriptionTransport;
  cost: number;
}

/**
 * {@link https://dev.twitch.tv/docs/api/reference#get-eventsub-subscriptions Twitch Docs}
 */
export function getSubscriptions(params?: GetSubscriptionParams) {
  return axios.get<any, AxiosResponse<SubscriptionsResponse, any>, any>(`${URL}/eventsub/subscriptions`, {
    headers: HEADERS,
    params,
  });
}

interface GetUsersParams {
  id?: string[];
  login?: string[];
}

interface User {
  broadcaster_type: '' | 'partner' | 'affiliate';
  description: string;
  display_name: string;
  id: string;
  login: string;
  offline_image_url: string;
  profile_image_url: string;
  type: 'staff' | 'admin' | 'global_mod' | '';
  view_count: number;
  email?: string;
  created_at: string;
}

/**
 * {@link https://dev.twitch.tv/docs/api/reference#get-users Twitch Docs}
 */
export function getUsers(params: GetUsersParams) {
  return axios.get<any, AxiosResponse<{ data: User[] }>>(`${URL}/users`, {
    headers: HEADERS,
    params,
  });
}

interface CreateSubscriptionParams {
  type: string;
  version: string;
  condition: any;
  transport: SubscriptionTransport;
}

/**
 * {@link https://dev.twitch.tv/docs/api/reference#create-eventsub-subscription Twitch Docs}
 */
export function createSubscription(params: CreateSubscriptionParams) {
  return axios.post<any, AxiosResponse<SubscriptionsResponse, any>>(`${URL}/eventsub/subscriptions`, params, {
    headers: {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`!,
    },
  });
}

interface GetStreamsParams {
  after?: string;
  before?: string;
  first?: number;
  game_id?: string;
  language?: string;
  user_id?: string[];
  user_login?: string[];
}

interface GetStreamsResponse {
  data: {
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id: string;
    game_name: string;
    type: 'live' | '';
    title: string;
    viewer_count: number;
    started_at: string;
    language: string;
    thumbnail_url: string;
    tag_ids: string[];
    is_mature: boolean;
  }[];
  pagnation: Pagination;
}

/**
 * {@link https://dev.twitch.tv/docs/api/reference#get-streams Twitch Docs}
 */
export function getStreams(params: GetStreamsParams) {
  return axios.get<any, AxiosResponse<GetStreamsResponse>>(`${URL}/streams`, { params, headers: HEADERS });
}
