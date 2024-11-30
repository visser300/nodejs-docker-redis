import { RedisClient } from '../storage/redis';
import { DataManager, WriteEntryResponse } from './DataManager';

export interface Customer {
    name: string;
    id: number;
    walletAddresses: string[];
}

export interface CustomerData {
    customers: Customer[];
}

export class CustomerDataManager extends DataManager {
    private readonly CUSTOMER_KEY = 'customer:';
    private readonly WALLET_KEY = 'wallet:';
    
    constructor(client: RedisClient) {
        super(client);
    }

    async writeCustomers(data: CustomerData): Promise<WriteEntryResponse[]> {
        try {
            const pipeline = this.client.multi();
            const responses: WriteEntryResponse[] = [];

            for (const customer of data.customers) {
                // Store customer data
                const customerKey = `${this.CUSTOMER_KEY}${customer.id}`;
                pipeline.set(customerKey, JSON.stringify(customer));
                responses.push({ success: true, key: customerKey });

                // Store wallet -> customer mappings
                for (const wallet of customer.walletAddresses) {
                    const walletKey = `${this.WALLET_KEY}${wallet}`;
                    pipeline.set(walletKey, customer.id.toString());
                    responses.push({ success: true, key: walletKey });
                }
            }

            await pipeline.exec();
            console.info(`Successfully wrote ${data.customers.length} customers to Redis`);
            return responses;
        } catch (error) {
            console.error('Error writing customers to Redis:', error);
            throw error;
        }
    }

    async getCustomerById(id: number): Promise<Customer | null> {
        return this.getData<Customer>(`${this.CUSTOMER_KEY}${id}`);
    }

    async getCustomerByWallet(wallet: string): Promise<Customer | null> {
        try {
            const customerId = await this.client.get(`${this.WALLET_KEY}${wallet}`);
            if (!customerId) {
                return null;
            }

            return this.getCustomerById(parseInt(customerId));
        } catch (error) {
            console.error('Error getting customer by wallet:', error);
            throw error;
        }
    }
}