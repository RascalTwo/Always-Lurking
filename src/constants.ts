require('dotenv').config();
export const HOSTNAME = process.env.HOSTNAME!;
export const CALLBACK_URL = 'https://' + HOSTNAME + '/api/webhook';
export const SUBSCRIPTION_SECRET = process.env.SUBSCRIPTION_SECRET!;
export const PORT = process.env.PORT || 3001;
export const MODIFY_PASSWORD = process.env.MODIFY_PASSWORD;
