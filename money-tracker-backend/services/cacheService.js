const redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    try {
      this.client = redis.createClient({
        socket: {
          host: 'localhost',
          port: 6379
        }
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔄 Connexion à Redis en cours...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connecté et prêt!');
        this.isConnected = true;
      });

      await this.client.connect();
      
    } catch (error) {
      console.warn('⚠️ Redis non disponible:', error.message);
      this.client = null;
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return false;
    }
  }

  async clearAll() {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Cache clear all error:', error);
      return false;
    }
  }

  async cacheWrapper(key, fetchFunction, ttl = 300) {
    const cached = await this.get(key);
    if (cached) {
      console.log(`📦 Cache HIT: ${key}`);
      return cached;
    }

    console.log(`🔄 Cache MISS: ${key}`);
    const data = await fetchFunction();
    await this.set(key, data, ttl);
    return data;
  }

  async invalidateContext(contextId) {
    await this.delPattern(`context:${contextId}:*`);
  }

  async invalidateProject(projectId) {
    await this.delPattern(`project:${projectId}:*`);
  }

  async invalidateTransactions() {
    await this.delPattern('transactions:*');
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

module.exports = new CacheService();
