import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

export const isConnected = async function (redisClient: RedisClient): Promise<boolean> {
  console.debug("Connecting Redis server");

  if (!redisClient.isOpen || !redisClient.isReady) {
    console.warn(`Redis server not ready`);
    return false;
  }

  const status = await redisClient.ping();
  console.info(`Redis connection response --> ${status}`);
  return status === "PONG";
};

export const createRedisClient = async function (redisUrl: string): Promise<RedisClient> {
  console.info("Creating Redis client");

  const clientOptions = {
    url: redisUrl,
    socket: {
      connectTimeout: 1000,
    },
  };

  const redisClient = createClient(clientOptions);

  redisClient.on("ready", () => console.log("Redis client ready"));
  redisClient.on("error", (e: any) => console.error("Redis client error", e));
  redisClient.on("end", () => console.error("Redis client closed"));

  await redisClient.connect();

  const connected = await isConnected(redisClient);
  if (!connected) {
    throw new Error("Redis connection failure");
  }

  // Clear all data
  await redisClient.flushAll();
  console.log("Redis data cleared");

  return redisClient;
};
