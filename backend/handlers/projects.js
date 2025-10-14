/**
 * Project management handlers
 */
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.createProject = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;
    const body = JSON.parse(event.body || '{}');
    const { name, domain } = body;

    if (!name) {
      return response.error('Project name is required', 400);
    }

    // Check user's project limit
    const user = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }).promise();

    if (!user.Item) {
      return response.error('User not found', 404);
    }

    const websiteCount = user.Item.usage?.websites || 0;
    const websiteLimit = user.Item.limits?.websites || 1;

    if (websiteCount >= websiteLimit) {
      return response.error(`Website limit reached. You have ${websiteCount}/${websiteLimit} websites. Upgrade your plan to track more websites.`, 403);
    }

    const project = {
      projectId: uuidv4(),
      userId,
      name,
      domain: domain || null,
      trackingCode: `snapit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalEvents: 0,
        totalPageViews: 0,
        totalUsers: 0,
        lastEvent: null
      }
    };

    await dynamodb.put({
      TableName: process.env.PROJECTS_TABLE,
      Item: project
    }).promise();

    // Update user's website count
    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET #usage.websites = if_not_exists(#usage.websites, :zero) + :inc',
      ExpressionAttributeNames: {
        '#usage': 'usage'
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':zero': 0
      }
    }).promise();

    return response.success({ project }, 201);

  } catch (error) {
    console.error('Create project error:', error);
    return response.error(error.message, 500);
  }
};

exports.listProjects = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;

    const result = await dynamodb.query({
      TableName: process.env.PROJECTS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    return response.success({ projects: result.Items || [] });

  } catch (error) {
    console.error('List projects error:', error);
    return response.error(error.message, 500);
  }
};

exports.getTrackingCode = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;
    const projectId = event.pathParameters.projectId;

    const result = await dynamodb.get({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId }
    }).promise();

    if (!result.Item) {
      return response.error('Project not found', 404);
    }

    if (result.Item.userId !== userId) {
      return response.error('Unauthorized', 403);
    }

    const trackingCode = `<!-- SnapIT Analytics -->
<script>
(function() {
  var analytics = window.snapitAnalytics = window.snapitAnalytics || [];
  analytics.projectId = '${projectId}';
  analytics.trackingCode = '${result.Item.trackingCode}';
  analytics.endpoint = 'https://api.snapitanalytics.com/track';

  analytics.track = function(event, properties) {
    fetch(analytics.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: analytics.projectId,
        trackingCode: analytics.trackingCode,
        event: event,
        properties: properties || {},
        timestamp: Date.now(),
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent
      })
    }).catch(function(err) { console.error('Analytics error:', err); });
  };

  // Auto-track page view
  analytics.track('page_view', {
    title: document.title,
    path: window.location.pathname
  });
})();
</script>`;

    return response.success({
      trackingCode,
      projectId,
      instructions: 'Add this code to the <head> section of your website'
    });

  } catch (error) {
    console.error('Get tracking code error:', error);
    return response.error(error.message, 500);
  }
};
