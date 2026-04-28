import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();
const disableRetry = process.env.REDIS_DISABLE_RETRY === 'true';
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ...(disableRetry
        ? {
            socket: {
                reconnectStrategy: () => false,
            },
        }
        : {}),
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));
export const connectRedis = async () => {
    try {
        await redisClient.connect();
    }
    catch (error) {
        console.warn('Redis connection failed, continuing without Redis:', error);
    }
};
export default redisClient;
