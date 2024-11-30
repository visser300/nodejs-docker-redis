import fs from 'node:fs/promises';
import { RedisClient } from "../storage/redis";

export interface WriteEntryResponse {
    success: boolean;
    key: string;
}

export abstract class DataManager {
    protected client: RedisClient;

    constructor(client: RedisClient) {
        this.client = client;
    }

    protected async getData<T>(key: string): Promise<T | null> {
        try {
            const data = await this.client.get(key);
            if (!data) {
                return null;
            }
            return JSON.parse(data) as T;
        } catch (error) {
            console.error(`Error getting data for key ${key}:`, error);
            return null;
        }
    }

    async readDataFile(fileName: string): Promise<any> {
        try {
            const data = await fs.readFile(`./data/${fileName}`, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading file ${fileName}:`, error);
            throw error;
        }
    }
}