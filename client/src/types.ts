export interface GroupPayload {
  name: string;
  slug: string;
  members: string[];
  online: { started: number, username: string}[];
}