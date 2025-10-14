/**
 * Tracking code generation handlers
 */
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const response = require('../utils/response');
const jwtUtil = require('../utils/jwt');

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Generate tracking code (creates a project)
 */
exports.generate = async (event) => {
  try {
    // Get user from JWT token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.error('Missing or invalid authorization header', 401);
    }

    const token = authHeader.substring(7);
    const decoded = jwtUtil.verify(token);

    if (!decoded || !decoded.userId) {
      return response.error('Invalid token', 401);
    }

    const userId = decoded.userId;
    const body = JSON.parse(event.body || '{}');
    const { websiteName, domain } = body;

    if (!websiteName) {
      return response.error('Website name is required', 400);
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

    const projectId = uuidv4();
    const trackingCodeKey = `snapit_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const project = {
      projectId,
      userId,
      name: websiteName,
      domain: domain || null,
      trackingCode: trackingCodeKey,
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

    // Generate tracking code snippet
    const trackingCode = `<!-- SnapIT Analytics -->
<script>
(function() {
  var analytics = window.snapitAnalytics = window.snapitAnalytics || [];
  analytics.projectId = '${projectId}';
  analytics.trackingCode = '${trackingCodeKey}';
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
      success: true,
      trackingCode,
      trackingId: projectId,
      projectId,
      project
    }, 201);

  } catch (error) {
    console.error('Generate tracking code error:', error);
    return response.error(error.message || 'Failed to generate tracking code', 500);
  }
};
