const { cacheMiddleware, invalidateCacheMiddleware } = require('./middleware/cacheMiddleware');

console.log('cacheMiddleware type:', typeof cacheMiddleware);
console.log('cacheMiddleware(300) type:', typeof cacheMiddleware(300));
console.log('invalidateCacheMiddleware type:', typeof invalidateCacheMiddleware);
console.log('invalidateCacheMiddleware([]) type:', typeof invalidateCacheMiddleware([]));

if (typeof cacheMiddleware(300) === 'function') {
  console.log('✅ cacheMiddleware works correctly');
} else {
  console.log('❌ cacheMiddleware is broken');
}

if (typeof invalidateCacheMiddleware([]) === 'function') {
  console.log('✅ invalidateCacheMiddleware works correctly');
} else {
  console.log('❌ invalidateCacheMiddleware is broken');
}
