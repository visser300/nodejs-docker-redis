import { WriteEntryResponse, DataManager } from "./DataManager";
import { RedisClient } from "../storage/redis";
import { CustomerDataManager } from "./CustomerDataManager";

export interface Transaction {
    involvesWatchonly: boolean;
    account: string;
    address: string;
    category: string;
    amount: number;
    label: string;
    confirmations: number;
    blockhash: string;
    blockindex: number;
    blocktime: number;
    txid: string;
    vout: number;
    walletconflicts: any[];
    time: number;
    timereceived: number;
    'bip125-replaceable': string;
}

export class TransactionDataManager extends DataManager {
    private readonly MIN_CONFIRMATION_BLOCK = 6;
    private readonly TRANSACTION_KEY = 'transaction:';
    private readonly CUSTOMER_TRANSACTIONS_KEY = 'transactions:customer:';
    private readonly ANON_TRANSACTIONS_KEY = 'transactions:anon:';
    protected customerDataManager: CustomerDataManager;
    
    constructor(client: RedisClient, customerDataManager: CustomerDataManager) {
        super(client);
        this.customerDataManager = customerDataManager
    }

    async writeTransactions(transactions: Transaction[]): Promise<WriteEntryResponse[]> {
        try {
            const responses: WriteEntryResponse[] = [];
            let totalDuplicatedTrans = 0
            for (const tx of transactions) {
                if (tx.amount > 0 && tx.confirmations >= this.MIN_CONFIRMATION_BLOCK && tx.category === 'receive') {

                    // Store full transaction data
                    const txKey = `${this.TRANSACTION_KEY}${tx.txid}`;
                    const exists = await this.client.exists(txKey);
                    if (exists) {
                        totalDuplicatedTrans++;
                        continue;
                    }

                    const pipeline = this.client.multi();
                    pipeline.set(txKey, JSON.stringify(tx));
                    responses.push({ success: true, key: txKey });

                    // Check if address belongs to a known customer
                    const customer = await this.customerDataManager.getCustomerByWallet(tx.address);

                    if (customer) {
                        // Add to customer transaction ranking
                        pipeline.zAdd(`${this.CUSTOMER_TRANSACTIONS_KEY}${customer.id}`, [{
                            score: tx.amount,
                            value: tx.txid
                        }]);
                    } else {
                        // Add to anon transaction ranking
                        pipeline.zAdd(this.ANON_TRANSACTIONS_KEY, [{
                            score: tx.amount,
                            value: tx.txid
                        }]);
                    }
                    await pipeline.exec();
                }
            }
            console.info(`Found ${totalDuplicatedTrans} duplicated transactions`);
            console.info(`Wrote ${responses.length} confirmed transactions to Redis (from ${transactions.length} total)`);
            return responses;
        } catch (error) {
            console.error('Error writing transactions to Redis:', error);
            throw error;
        }
    }

    async getTransactionrById(txid: string): Promise<Transaction | null> {
        const txKey = `${this.TRANSACTION_KEY}${txid}`;
        return this.getData<Transaction>(txKey);
    }

    /**
     * Get transaction statistics for a customer
     */
    async getCustomerTransactionStats(customerId: number | null) {
        const key = customerId ? `${this.CUSTOMER_TRANSACTIONS_KEY}${customerId}` : this.ANON_TRANSACTIONS_KEY;
        const [count, minTx, maxTx, all] = await Promise.all([
            this.client.zCard(key),
            this.client.zRangeByScore(key, '-inf', '+inf', {
                LIMIT: { offset: 0, count: 1 }
            }),
            this.client.zRangeByScore(key, '-inf', '+inf', {
                LIMIT: { offset: 0, count: 1 }
            }),
            this.client.zRangeByScore(key, '-inf', '+inf')
        ]);

        let totalAmount = 0.0;
        let min = await this.getTransactionrById(minTx[0]);
        let max = await this.getTransactionrById(maxTx[0]);
        for (const txid of all) {
            const transaction = await this.getTransactionrById(txid)
            if (transaction) {
                totalAmount = totalAmount + transaction.amount
            }
        }

        return {
            totalTransactions: count,
            totalAmount: totalAmount,
            minAmount: min != null ? min.amount : 0,
            maxAmount: max != null ? max.amount : 0,
        };
    }
}