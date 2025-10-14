/**
 * Authentication handler - Google OAuth
 */
const { OAuth2Client } = require('google-auth-library');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const jwtUtil = require('../utils/jwt');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { credential } = body;

    if (!credential) {
      return response.error('Missing Google credential', 400);
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    const existingUser = await dynamodb.query({
      TableName: process.env.USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    let user;

    if (existingUser.Items.length > 0) {
      // Update existing user
      user = existingUser.Items[0];
      await dynamodb.update({
        TableName: process.env.USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: 'SET #name = :name, picture = :picture, lastLogin = :lastLogin',
        ExpressionAttributeNames: {
          '#name': 'name'
        },
        ExpressionAttributeValues: {
          ':name': name,
          ':picture': picture,
          ':lastLogin': Date.now()
        }
      }).promise();
    } else {
      // Create new user
      user = {
        userId: uuidv4(),
        email,
        name,
        picture,
        googleId,
        plan: 'free',
        stripeCustomerId: null,
        subscriptionId: null,
        subscriptionStatus: null,
        usage: {
          events: 0,
          websites: 0,
          monthlyEvents: 0
        },
        limits: {
          events: -1,      // Free tier: unlimited events
          websites: 1,     // Free tier: 1 website/page
          updateInterval: 86400000  // 24 hours in milliseconds
        },
        createdAt: Date.now(),
        lastLogin: Date.now(),
        lastAnalyticsUpdate: 0
      };

      await dynamodb.put({
        TableName: process.env.USERS_TABLE,
        Item: user
      }).promise();
    }

    // Generate JWT tokens
    const accessToken = jwtUtil.sign({
      userId: user.userId,
      email: user.email,
      plan: user.plan
    });

    const refreshToken = jwtUtil.sign({
      userId: user.userId,
      type: 'refresh'
    }, '30d');

    return response.success({
      success: true,
      tokens: {
        accessToken,
        refreshToken
      },
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        plan: user.plan,
        usage: user.usage,
        limits: user.limits
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    return response.error(error.message || 'Authentication failed', 500);
  }
};

/**
 * Verify JWT token
 */
exports.verify = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.error('Missing or invalid authorization header', 401);
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwtUtil.verify(token);

    if (!decoded || !decoded.userId) {
      return response.error('Invalid token', 401);
    }

    // Get user from database
    const user = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId: decoded.userId }
    }).promise();

    if (!user.Item) {
      return response.error('User not found', 404);
    }

    return response.success({
      valid: true,
      user: {
        userId: user.Item.userId,
        email: user.Item.email,
        name: user.Item.name,
        picture: user.Item.picture,
        plan: user.Item.plan,
        usage: user.Item.usage,
        limits: user.Item.limits
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return response.error('Invalid or expired token', 401);
  }
};

/**
 * Verify access key (for API access)
 */
exports.verifyKey = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { accessKey } = body;

    if (!accessKey) {
      return response.error('Missing access key', 400);
    }

    // Query user by accessKey (we'll need to add this field and GSI)
    // For now, just return error as this feature needs database schema update
    return response.error('Access key verification not yet implemented. Use JWT tokens instead.', 501);

  } catch (error) {
    console.error('Access key verification error:', error);
    return response.error('Verification failed', 500);
  }
};
