require('dotenv').config();
export const HOSTNAME = process.env.HOSTNAME!;
export const SUBSCRIPTION_SECRET = process.env.SUBSCRIPTION_SECRET!;
export const PORT = process.env.PORT || 3001;
