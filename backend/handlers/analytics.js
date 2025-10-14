/**
 * Analytics tracking and retrieval handlers
 */
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.trackBatch = async (event) => {
  console.log('Track batch request:', {
    headers: event.headers,
    source: event.requestContext?.identity?.sourceIp
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { projectId, trackingCode, events: batchEvents } = body;

    if (!projectId || !trackingCode || !Array.isArray(batchEvents)) {
      console.warn('Missing required fields for batch');
      return response.error('Missing required fields: projectId, trackingCode, and events array are required', 400);
    }

    // Verify tracking code once for the batch
    const project = await dynamodb.get({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId }
    }).promise();

    if (!project.Item) {
      console.warn('Project not found:', projectId);
      return response.error('Project not found', 404);
    }

    if (project.Item.trackingCode !== trackingCode) {
      console.warn('Invalid tracking code for project:', projectId);
      return response.error('Invalid tracking code', 403);
    }

    // Process batch events
    const eventIds = [];
    const items = batchEvents.map(evt => {
      const eventId = uuidv4();
      eventIds.push(eventId);
      return {
        PutRequest: {
          Item: {
            eventId,
            projectId,
            event: evt.event,
            properties: evt.properties || {},
            timestamp: evt.timestamp || Date.now(),
            url: evt.url,
            referrer: evt.referrer,
            userAgent: evt.userAgent,
            ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
          }
        }
      };
    });

    // Batch write events (max 25 at a time)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await dynamodb.batchWrite({
        RequestItems: {
          [process.env.EVENTS_TABLE]: batch
        }
      }).promise();
    }

    // Update project stats
    await dynamodb.update({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId },
      UpdateExpression: 'SET stats.totalEvents = if_not_exists(stats.totalEvents, :zero) + :inc, stats.lastEvent = :timestamp',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': batchEvents.length,
        ':timestamp': Date.now()
      }
    }).promise();

    // Update user monthly events
    if (project.Item && project.Item.userId) {
      await dynamodb.update({
        TableName: process.env.USERS_TABLE,
        Key: { userId: project.Item.userId },
        UpdateExpression: 'SET #usage.monthlyEvents = if_not_exists(#usage.monthlyEvents, :zero) + :inc',
        ExpressionAttributeNames: {
          '#usage': 'usage'
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': batchEvents.length
        }
      }).promise();
    }

    console.log('Batch events tracked successfully:', {
      projectId,
      eventCount: batchEvents.length
    });

    return response.success({ success: true, eventIds, count: batchEvents.length });

  } catch (error) {
    console.error('Track batch error:', {
      message: error.message,
      stack: error.stack
    });
    return response.error('Failed to track batch: ' + error.message, 500);
  }
};

exports.trackEvent = async (event) => {
  console.log('Track event request:', {
    body: event.body,
    headers: event.headers,
    source: event.requestContext?.identity?.sourceIp
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      projectId,
      trackingCode,
      event: eventName,
      properties,
      timestamp,
      url,
      referrer,
      userAgent
    } = body;

    if (!projectId || !trackingCode || !eventName) {
      console.warn('Missing required fields:', { projectId, trackingCode, eventName });
      return response.error('Missing required fields: projectId, trackingCode, and event are required', 400);
    }

    // Verify tracking code
    const project = await dynamodb.get({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId }
    }).promise();

    if (!project.Item) {
      console.warn('Project not found:', projectId);
      return response.error('Project not found', 404);
    }

    if (project.Item.trackingCode !== trackingCode) {
      console.warn('Invalid tracking code for project:', projectId);
      return response.error('Invalid tracking code', 403);
    }

    // No event limits on free tier - unlimited events allowed

    const eventData = {
      eventId: uuidv4(),
      projectId,
      event: eventName,
      properties: properties || {},
      timestamp: timestamp || Date.now(),
      url,
      referrer,
      userAgent,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days retention
    };

    // Store event
    await dynamodb.put({
      TableName: process.env.EVENTS_TABLE,
      Item: eventData
    }).promise();

    // Update project stats
    await dynamodb.update({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId },
      UpdateExpression: 'SET stats.totalEvents = if_not_exists(stats.totalEvents, :zero) + :inc, stats.lastEvent = :timestamp',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':timestamp': eventData.timestamp
      }
    }).promise();

    // Update user monthly events
    if (project.Item && project.Item.userId) {
      await dynamodb.update({
        TableName: process.env.USERS_TABLE,
        Key: { userId: project.Item.userId },
        UpdateExpression: 'SET #usage.monthlyEvents = if_not_exists(#usage.monthlyEvents, :zero) + :inc',
        ExpressionAttributeNames: {
          '#usage': 'usage'
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1
        }
      }).promise();
    }

    console.log('Event tracked successfully:', {
      eventId: eventData.eventId,
      projectId,
      event: eventName
    });

    return response.success({ success: true, eventId: eventData.eventId });

  } catch (error) {
    console.error('Track event error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return response.error('Failed to track event: ' + error.message, 500);
  }
};

exports.getAnalytics = async (event) => {
  console.log('Get analytics request:', {
    userId: event.requestContext.authorizer?.userId,
    projectId: event.pathParameters?.projectId,
    queryParams: event.queryStringParameters
  });

  try {
    const userId = event.requestContext.authorizer.userId;
    const projectId = event.pathParameters.projectId;
    const queryParams = event.queryStringParameters || {};
    const timeRange = queryParams.timeRange || '7d';

    // Get user to check update interval
    const user = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }).promise();

    if (!user.Item) {
      return response.error('User not found', 404);
    }

    // Check if user can fetch analytics based on their plan's update interval
    const now = Date.now();
    const lastUpdate = user.Item.lastAnalyticsUpdate || 0;
    const updateInterval = user.Item.limits?.updateInterval || 86400000; // default 24 hours
    const timeUntilNext = (lastUpdate + updateInterval) - now;

    if (timeUntilNext > 0 && user.Item.plan === 'free') {
      const hoursRemaining = Math.ceil(timeUntilNext / (1000 * 60 * 60));
      return response.error(`Analytics update available in ${hoursRemaining} hours. Free plan updates every 24 hours. Upgrade for real-time updates.`, 429);
    }

    // Verify project ownership
    const project = await dynamodb.get({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId }
    }).promise();

    if (!project.Item) {
      return response.error('Project not found', 404);
    }

    if (project.Item.userId !== userId) {
      return response.error('Unauthorized', 403);
    }

    // Calculate time range
    let startTime;
    switch (timeRange) {
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startTime = now - (90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (7 * 24 * 60 * 60 * 1000);
    }

    // Get events for the project
    const events = await dynamodb.query({
      TableName: process.env.EVENTS_TABLE,
      IndexName: 'ProjectIdTimestampIndex',
      KeyConditionExpression: 'projectId = :projectId AND #ts >= :startTime',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':projectId': projectId,
        ':startTime': startTime
      },
      ScanIndexForward: false,
      Limit: 1000
    }).promise();

    // Aggregate analytics
    const analytics = aggregateAnalytics(events.Items || []);

    // Update user's last analytics update time
    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET lastAnalyticsUpdate = :now',
      ExpressionAttributeValues: {
        ':now': now
      }
    }).promise();

    console.log('Analytics retrieved successfully:', {
      projectId,
      timeRange,
      eventCount: events.Items?.length || 0,
      userId
    });

    return response.success({
      projectId,
      timeRange,
      analytics,
      project: {
        name: project.Item.name,
        domain: project.Item.domain,
        stats: project.Item.stats
      },
      nextUpdateAvailable: now + updateInterval
    });

  } catch (error) {
    console.error('Get analytics error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      projectId: event.pathParameters?.projectId,
      userId: event.requestContext.authorizer?.userId
    });
    return response.error('Failed to retrieve analytics: ' + error.message, 500);
  }
};

function aggregateAnalytics(events) {
  const analytics = {
    totalEvents: events.length,
    pageViews: 0,
    uniqueUrls: new Set(),
    uniqueVisitors: new Set(),
    uniqueSessions: new Set(),
    eventsByType: {},
    eventsByDay: {},
    topPages: {},
    topReferrers: {},
    browsers: {},
    devices: {},
    // Advanced metrics
    clickHeatMap: [],
    scrollDepth: { 25: 0, 50: 0, 75: 0, 100: 0 },
    avgVisitDuration: 0,
    totalVisitDuration: 0,
    visitDurationCount: 0,
    conversions: 0,
    conversionEvents: [],
    abandonedCarts: 0,
    ecommerce: {
      addToCart: 0,
      removeFromCart: 0,
      checkoutStarted: 0,
      purchases: 0,
      revenue: 0
    },
    formSubmissions: 0,
    errors: 0,
    bounceRate: 0,
    avgScrollDepth: 0,
    outboundLinks: [],
    topClickedElements: {}
  };

  events.forEach(event => {
    // Count by event type
    analytics.eventsByType[event.event] = (analytics.eventsByType[event.event] || 0) + 1;

    // Track unique visitors and sessions
    if (event.properties?.visitorId) {
      analytics.uniqueVisitors.add(event.properties.visitorId);
    }
    if (event.properties?.sessionId) {
      analytics.uniqueSessions.add(event.properties.sessionId);
    }

    // Page views
    if (event.event === 'page_view') {
      analytics.pageViews++;
    }

    // Track URLs
    if (event.url) {
      analytics.uniqueUrls.add(event.url);
      analytics.topPages[event.url] = (analytics.topPages[event.url] || 0) + 1;
    }

    // Track referrers
    if (event.referrer) {
      analytics.topReferrers[event.referrer] = (analytics.topReferrers[event.referrer] || 0) + 1;
    }

    // Group by day
    const day = new Date(event.timestamp).toISOString().split('T')[0];
    analytics.eventsByDay[day] = (analytics.eventsByDay[day] || 0) + 1;

    // Parse user agent for browser/device info
    if (event.userAgent) {
      const ua = event.userAgent.toLowerCase();
      if (ua.includes('chrome')) analytics.browsers.Chrome = (analytics.browsers.Chrome || 0) + 1;
      else if (ua.includes('firefox')) analytics.browsers.Firefox = (analytics.browsers.Firefox || 0) + 1;
      else if (ua.includes('safari')) analytics.browsers.Safari = (analytics.browsers.Safari || 0) + 1;
      else if (ua.includes('edge')) analytics.browsers.Edge = (analytics.browsers.Edge || 0) + 1;
      else analytics.browsers.Other = (analytics.browsers.Other || 0) + 1;

      if (ua.includes('mobile')) analytics.devices.Mobile = (analytics.devices.Mobile || 0) + 1;
      else analytics.devices.Desktop = (analytics.devices.Desktop || 0) + 1;
    }

    // Advanced analytics
    const props = event.properties || {};

    // Click heat map data
    if (event.event === 'click' && props.clickX && props.clickY) {
      analytics.clickHeatMap.push({
        x: props.clickX,
        y: props.clickY,
        element: props.element,
        timestamp: event.timestamp
      });

      // Track top clicked elements
      const elementPath = props.elementPath || props.element || 'unknown';
      analytics.topClickedElements[elementPath] = (analytics.topClickedElements[elementPath] || 0) + 1;
    }

    // Scroll depth tracking
    if (event.event === 'scroll_depth' && props.depth) {
      analytics.scrollDepth[props.depth] = (analytics.scrollDepth[props.depth] || 0) + 1;
    }

    // Visit duration tracking
    if (props.visitDuration && props.visitDuration > 0) {
      analytics.totalVisitDuration += props.visitDuration;
      analytics.visitDurationCount++;
    }

    // Conversion tracking
    if (event.event === 'conversion') {
      analytics.conversions++;
      analytics.conversionEvents.push({
        name: props.name,
        value: props.value,
        timestamp: event.timestamp
      });
    }

    // E-commerce tracking
    if (event.event === 'add_to_cart') {
      analytics.ecommerce.addToCart++;
    } else if (event.event === 'remove_from_cart') {
      analytics.ecommerce.removeFromCart++;
    } else if (event.event === 'checkout_started') {
      analytics.ecommerce.checkoutStarted++;
    } else if (event.event === 'purchase') {
      analytics.ecommerce.purchases++;
      if (props.total) {
        analytics.ecommerce.revenue += parseFloat(props.total) || 0;
      }
    } else if (event.event === 'cart_abandoned') {
      analytics.abandonedCarts++;
    }

    // Form submissions
    if (event.event === 'form_submit') {
      analytics.formSubmissions++;
    }

    // Error tracking
    if (event.event === 'javascript_error') {
      analytics.errors++;
    }

    // Outbound links
    if (event.event === 'outbound_link' && props.destination) {
      analytics.outboundLinks.push({
        destination: props.destination,
        text: props.text,
        timestamp: event.timestamp
      });
    }
  });

  // Calculate averages
  if (analytics.visitDurationCount > 0) {
    analytics.avgVisitDuration = Math.round(analytics.totalVisitDuration / analytics.visitDurationCount);
  }

  // Calculate bounce rate (sessions with only 1 event)
  const sessionEventCounts = {};
  events.forEach(event => {
    const sessionId = event.properties?.sessionId;
    if (sessionId) {
      sessionEventCounts[sessionId] = (sessionEventCounts[sessionId] || 0) + 1;
    }
  });
  const bouncedSessions = Object.values(sessionEventCounts).filter(count => count === 1).length;
  const totalSessions = Object.keys(sessionEventCounts).length;
  analytics.bounceRate = totalSessions > 0 ? Math.round((bouncedSessions / totalSessions) * 100) : 0;

  // Convert sets and sort top items
  analytics.uniqueUrls = analytics.uniqueUrls.size;
  analytics.uniqueVisitors = analytics.uniqueVisitors.size;
  analytics.uniqueSessions = analytics.uniqueSessions.size;

  analytics.topPages = Object.entries(analytics.topPages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  analytics.topReferrers = Object.entries(analytics.topReferrers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  analytics.topClickedElements = Object.entries(analytics.topClickedElements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([element, count]) => ({ element, count }));

  // Limit heat map data to last 1000 clicks for performance
  analytics.clickHeatMap = analytics.clickHeatMap
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 1000);

  return analytics;
}
