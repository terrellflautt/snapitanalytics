/**
 * Lambda authorizer for API Gateway
 */
const jwtUtil = require('../utils/jwt');

exports.handler = async (event) => {
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  const decoded = jwtUtil.verify(token);

  if (!decoded) {
    throw new Error('Unauthorized');
  }

  return {
    principalId: decoded.userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn.split('/').slice(0, 2).join('/') + '/*'
        }
      ]
    },
    context: {
      userId: decoded.userId,
      email: decoded.email,
      plan: decoded.plan || 'free'
    }
  };
};
