/**
 * Health check endpoint
 */
const response = require('../utils/response');

exports.handler = async (event) => {
  return response.success({
    status: 'healthy',
    service: 'snapitanalytics-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};
