/**
 * User management handlers
 */
const AWS = require('aws-sdk');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getUser = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;

    const result = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }).promise();

    if (!result.Item) {
      return response.error('User not found', 404);
    }

    const user = result.Item;
    delete user.googleId; // Don't expose sensitive data

    return response.success({ user });

  } catch (error) {
    console.error('Get user error:', error);
    return response.error(error.message, 500);
  }
};

exports.updateUser = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;
    const body = JSON.parse(event.body || '{}');

    // Only allow updating certain fields
    const allowedFields = ['name'];
    const updates = {};
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};

    Object.keys(body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = body[key];
        updateExpression += `${key} = :${key}, `;
        expressionAttributeValues[`:${key}`] = body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return response.error('No valid fields to update', 400);
    }

    updateExpression = updateExpression.slice(0, -2); // Remove trailing comma

    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();

    return response.success({ message: 'User updated successfully' });

  } catch (error) {
    console.error('Update user error:', error);
    return response.error(error.message, 500);
  }
};
