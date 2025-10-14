/**
 * Real-time monitoring and dashboard handlers
 */
const AWS = require('aws-sdk');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Get real-time dashboard data
 */
exports.getDashboard = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;

    // Get user's projects
    const projects = await dynamodb.query({
      TableName: process.env.PROJECTS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    if (!projects.Items || projects.Items.length === 0) {
      return response.success({
        projects: [],
        totalEvents: 0,
        totalPageViews: 0,
        totalUsers: 0,
        realtimeVisitors: 0
      });
    }

    // Aggregate stats from all projects
    let totalEvents = 0;
    let totalPageViews = 0;
    let totalUsers = 0;

    projects.Items.forEach(project => {
      totalEvents += project.stats?.totalEvents || 0;
      totalPageViews += project.stats?.totalPageViews || 0;
      totalUsers += project.stats?.totalUsers || 0;
    });

    // Get recent events (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentEvents = [];

    for (const project of projects.Items) {
      const events = await dynamodb.query({
        TableName: process.env.EVENTS_TABLE,
        IndexName: 'ProjectIdTimestampIndex',
        KeyConditionExpression: 'projectId = :projectId AND #ts > :timestamp',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':projectId': project.projectId,
          ':timestamp': oneDayAgo
        },
        Limit: 100
      }).promise();

      if (events.Items) {
        recentEvents.push(...events.Items);
      }
    }

    // Calculate real-time visitors (active in last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const realtimeVisitors = recentEvents.filter(e =>
      e.timestamp > fiveMinutesAgo && e.event === 'page_view'
    ).length;

    return response.success({
      projects: projects.Items.map(p => ({
        projectId: p.projectId,
        name: p.name,
        domain: p.domain,
        stats: p.stats
      })),
      totalEvents,
      totalPageViews,
      totalUsers,
      realtimeVisitors,
      recentEvents: recentEvents.slice(0, 50).map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        properties: e.properties,
        url: e.url
      }))
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    return response.error(error.message, 500);
  }
};

/**
 * Server-Sent Events stream for real-time updates
 * Note: API Gateway doesn't support long-lived connections well
 * This is a polling fallback endpoint
 */
exports.stream = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;

    // Get latest events for user's projects
    const projects = await dynamodb.query({
      TableName: process.env.PROJECTS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    const recentEvents = [];
    const oneMinuteAgo = Date.now() - (60 * 1000);

    for (const project of projects.Items || []) {
      const events = await dynamodb.query({
        TableName: process.env.EVENTS_TABLE,
        IndexName: 'ProjectIdTimestampIndex',
        KeyConditionExpression: 'projectId = :projectId AND #ts > :timestamp',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':projectId': project.projectId,
          ':timestamp': oneMinuteAgo
        },
        Limit: 20
      }).promise();

      if (events.Items) {
        recentEvents.push(...events.Items);
      }
    }

    return response.success({
      events: recentEvents.map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        projectId: e.projectId,
        properties: e.properties
      })),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Stream error:', error);
    return response.error(error.message, 500);
  }
};
