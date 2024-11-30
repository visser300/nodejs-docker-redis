import { createRedisClient, RedisClient } from "./storage/redis";
import { CustomerDataManager } from './services/CustomerDataManager';
import { TransactionDataManager } from './services/TransactionDataManager';

class Application {
  private customerDataManager: CustomerDataManager;
  private transactionDataManager: TransactionDataManager;

  constructor(client: RedisClient) {
      this.customerDataManager = new CustomerDataManager(client);
      this.transactionDataManager = new TransactionDataManager(client, this.customerDataManager);
  }

  async init() {
      try {
          console.info("Starting application");

          const [customers, transactions1, transactions2] = await Promise.all([
              this.customerDataManager.readDataFile('customers.json'),
              this.transactionDataManager.readDataFile('transactions-1.json'),
              this.transactionDataManager.readDataFile('transactions-2.json')
          ]);

          const allTransactions = [...transactions1.transactions, ...transactions2.transactions];

          await this.customerDataManager.writeCustomers(customers);
          await this.transactionDataManager.writeTransactions(allTransactions);

      } catch (error) {
          console.error("Application error:", error);
          throw error;
      }
  }

  async stats() {
      try {
          const customers = [
            {
              "name": "Wesley Crusher",
              "address": "mvd6qFeVkqH6MNAS2Y2cLifbdaX5XUkbZJ"
            },
            {
              "name": "Leonard McCoy",
              "address": "mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp"
            },
            {
              "name": "Jonathan Archer",
              "address": "mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n"
            },
            {
              "name": "Jadzia Dax",
              "address": "2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo"
            },
            {
              "name": "Montgomery Scott",
              "address": "mutrAf4usv3HKNdpLwVD4ow2oLArL6Rez8"
            },
            {
              "name": "James T. Kirk",
              "address": "miTHhiX3iFhVnAEecLjybxvV5g8mKYTtnM"
            },
            {
              "name": "Spock",
              "address": "mvcyJMiAcSXKAEsQxbW9TYZ369rsMG6rVV"
            }
          ]

          let min = -1, max = 0;

          for (const customer of customers) {
            const customerData = await this.customerDataManager.getCustomerByWallet(customer.address);
            if (customerData && customerData.id) {
                const transactionData = await this.transactionDataManager.getCustomerTransactionStats(customerData.id);
                console.log(`Deposited for ${customer.name}: count=${transactionData.totalTransactions} sum=${transactionData.totalAmount.toFixed(8)}`);

                // extract min value
                if (min === -1) min = transactionData.minAmount;
                else min = Math.min(transactionData.minAmount, min);

                // extract max value
                max = Math.max(transactionData.maxAmount, max);
            } else {
                throw new Error('Customer not found');
            }
          }

          const transactionData = await this.transactionDataManager.getCustomerTransactionStats(null);
          console.log(`Deposited without reference: count=${transactionData.totalTransactions} sum=${transactionData.totalAmount.toFixed(8)}`);
          min = Math.min(transactionData.minAmount, min);
          max = Math.max(transactionData.maxAmount, max);
          console.log(`Smallest valid deposit: ${min.toFixed(8)}`);
          console.log(`Largest valid deposit: ${max.toFixed(8)}`);
      } catch (error) {
          console.error("Application error:", error);
          throw error;
      }
  }
}

// Entry point
const initialize = async (): Promise<void> => {
  try {
      const redisUrl = "redis://redis-server:6379";
      const client = await createRedisClient(redisUrl);
      
      const app = new Application(client);
      await app.init();

      // show stats
      await app.stats();
  } catch (error) {
      console.error("Initialization error:", error);
      process.exit(1);
  }
};

initialize();