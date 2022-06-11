import axios, { AxiosResponse } from 'axios';

const BASE_URL = 'https://api.twitch.tv/helix';

const HEADERS = {
  'Client-Id': process.env.TWITCH_CLIENT_ID!,
  Authorization: `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`!,
};

/**
 * {@link https://dev.twitch.tv/docs/api/reference#delete-eventsub-subscription Twitch Docs}
 */
export function deleteSubscription(id: string) {
  return axios.delete<any, AxiosResponse<void, any>>(`${BASE_URL}/eventsub/subscriptions`, {
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

type Pagination = { cursor?: string };
interface Pageable {
  pagination: Pagination;
}
interface GetSubscriptionParams {
  status?: SubscriptionStatus;
  type?: string;
  after?: string;
}

interface SubscriptionsResponse extends Pageable {
  total: number;
  total_cost: number;
  max_total_cost: number;
  data: Subscription[];
}

interface SubscriptionTransport {
  method: 'webhook';
  callback: string;
  secret: string;
}

export interface Subscription {
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
  return axios.get<any, AxiosResponse<SubscriptionsResponse, any>, any>(`${BASE_URL}/eventsub/subscriptions`, {
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
  return axios.get<any, AxiosResponse<{ data: User[] }>>(`${BASE_URL}/users`, {
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
  return axios.post<any, AxiosResponse<SubscriptionsResponse, any>>(`${BASE_URL}/eventsub/subscriptions`, params, {
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

interface GetStreamsResponse extends Pageable {
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
}

/**
 * {@link https://dev.twitch.tv/docs/api/reference#get-streams Twitch Docs}
 */
export function getStreams(params: GetStreamsParams) {
  return axios.get<any, AxiosResponse<GetStreamsResponse>>(`${BASE_URL}/streams`, { params, headers: HEADERS });
}

interface GetScheduleParams {
  broadcaster_id: string
}

export interface ScheduleSegment {
  id: string
  start_time: string
  end_time: string
  title: string
  canceled_until: string | null
  category: {
    id: string
    name: string
  } | null
  is_recurring: string
}

interface GetScheduleResponse extends Pageable {
  data: {
    segments: ScheduleSegment[]
    broadcaster_id: string
    broadcaster_name: string
    broadcaster_login: string
    vacation: {
      start_time: string
      end_time: string
    } | null
  }
}

export function getSchedule(params: GetScheduleParams){
  return axios.get<any, AxiosResponse<GetScheduleResponse>>(`${BASE_URL}/schedule`, { params, headers: HEADERS });
}

export async function paginageResults<T extends Pageable>(response: AxiosResponse<T>) {
  const results: T[] = [response.data];

  while (response.data.pagination.cursor) {
    response = await axios.request({
      ...response.config,
      params: { ...response.config.params, after: response.data.pagination.cursor },
    });
    results.push(response.data);
  }
  return results;
}
