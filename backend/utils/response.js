/**
 * Utility functions for API responses
 */

const success = (data, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

const error = (message, statusCode = 400) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ error: message })
});

module.exports = {
  success,
  error
};
