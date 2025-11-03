import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

redis.on("connect", () => {});

redis.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
});

export default redis;
