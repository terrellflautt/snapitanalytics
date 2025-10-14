/**
 * Billing and subscription handlers
 */
const AWS = require('aws-sdk');
const Stripe = require('stripe');
const response = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createCheckoutSession = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;
    const body = JSON.parse(event.body || '{}');
    const { priceId, plan } = body;

    if (!priceId) {
      return response.error('Price ID is required', 400);
    }

    // Get user
    const user = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }).promise();

    if (!user.Item) {
      return response.error('User not found', 404);
    }

    // Create or get Stripe customer
    let customerId = user.Item.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.Item.email,
        name: user.Item.name,
        metadata: {
          userId: userId
        }
      });
      customerId = customer.id;

      await dynamodb.update({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET stripeCustomerId = :customerId',
        ExpressionAttributeValues: {
          ':customerId': customerId
        }
      }).promise();
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${body.successUrl || 'https://snapitanalytics.com'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl || 'https://snapitanalytics.com',
      metadata: {
        userId,
        plan
      }
    });

    return response.success({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    return response.error(error.message, 500);
  }
};

exports.webhookStripe = async (event) => {
  try {
    const sig = event.headers['Stripe-Signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    if (webhookSecret) {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } else {
      stripeEvent = JSON.parse(event.body);
    }

    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return response.success({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return response.error(error.message, 400);
  }
};

exports.cancelSubscription = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId;

    const user = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }).promise();

    if (!user.Item || !user.Item.subscriptionId) {
      return response.error('No active subscription found', 404);
    }

    // Cancel subscription at period end
    await stripe.subscriptions.update(user.Item.subscriptionId, {
      cancel_at_period_end: true
    });

    return response.success({
      message: 'Subscription will be cancelled at the end of the billing period'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return response.error(error.message, 500);
  }
};

// Helper functions
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;

  await stripe.subscriptions.retrieve(session.subscription).then(async (subscription) => {
    const limits = getPlanLimits(plan);

    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET plan = :plan, subscriptionId = :subscriptionId, subscriptionStatus = :status, limits = :limits, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':plan': plan,
        ':subscriptionId': subscription.id,
        ':status': subscription.status,
        ':limits': limits,
        ':updatedAt': Date.now()
      }
    }).promise();
  });
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;

  const users = await dynamodb.scan({
    TableName: process.env.USERS_TABLE,
    FilterExpression: 'stripeCustomerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': customerId
    }
  }).promise();

  if (users.Items.length > 0) {
    const user = users.Items[0];
    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET subscriptionStatus = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': subscription.status,
        ':updatedAt': Date.now()
      }
    }).promise();
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  const users = await dynamodb.scan({
    TableName: process.env.USERS_TABLE,
    FilterExpression: 'stripeCustomerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': customerId
    }
  }).promise();

  if (users.Items.length > 0) {
    const user = users.Items[0];
    const freeLimits = getPlanLimits('free');

    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET plan = :plan, subscriptionId = :null, subscriptionStatus = :status, limits = :limits, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':plan': 'free',
        ':null': null,
        ':status': 'cancelled',
        ':limits': freeLimits,
        ':updatedAt': Date.now()
      }
    }).promise();
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded for invoice:', invoice.id);
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed for invoice:', invoice.id);
}

function getPlanLimits(plan) {
  const limits = {
    free: {
      events: -1,              // unlimited events
      websites: 1,             // 1 website/page
      updateInterval: 86400000 // 24 hours
    },
    starter: {
      events: -1,              // unlimited events
      websites: 5,             // 5 websites
      updateInterval: 3600000  // 1 hour
    },
    professional: {
      events: -1,              // unlimited events
      websites: 20,            // 20 websites
      updateInterval: 300000   // 5 minutes
    },
    business: {
      events: -1,              // unlimited events
      websites: 100,           // 100 websites
      updateInterval: 60000    // 1 minute (real-time)
    }
  };

  return limits[plan] || limits.free;
}
