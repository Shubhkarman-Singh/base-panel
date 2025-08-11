/**
 * Format bytes according to the configured unit prefix
 * @param {number} bytes - Number of bytes
 * @param {Object} settings - Application settings
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted string with appropriate unit
 */
function formatBytes(bytes, settings = {}, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const unitPrefix = settings.unitPrefix || 'decimal';
  
  if (unitPrefix === 'binary') {
    // Binary prefixes (1024-based): KiB, MiB, GiB, TiB, PiB
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  } else {
    // Decimal prefixes (1000-based): KB, MB, GB, TB, PB
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

/**
 * Format disk usage with appropriate units
 * @param {number} used - Used bytes
 * @param {number} total - Total bytes
 * @param {Object} settings - Application settings
 * @returns {Object} Object with formatted used, total, and percentage
 */
function formatDiskUsage(used, total, settings = {}) {
  return {
    used: formatBytes(used, settings),
    total: formatBytes(total, settings),
    percentage: total > 0 ? Math.round((used / total) * 100) : 0
  };
}

/**
 * Format memory usage with appropriate units
 * @param {number} memory - Memory in bytes
 * @param {Object} settings - Application settings
 * @returns {string} Formatted memory string
 */
function formatMemory(memory, settings = {}) {
  return formatBytes(memory, settings);
}

/**
 * Format network speed/bandwidth
 * @param {number} bytesPerSecond - Bytes per second
 * @param {Object} settings - Application settings
 * @returns {string} Formatted speed string
 */
function formatSpeed(bytesPerSecond, settings = {}) {
  const formatted = formatBytes(bytesPerSecond, settings);
  return formatted + '/s';
}

module.exports = {
  formatBytes,
  formatDiskUsage,
  formatMemory,
  formatSpeed
};