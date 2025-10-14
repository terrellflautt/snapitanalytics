# SnapIT Analytics

**Free, Privacy-Focused Web Analytics Platform**

A complete no-code web analytics solution with Google OAuth authentication, real-time tracking, beautiful dashboards, and Stripe payment integration.

## 🚀 Features

### Core Analytics
- ✅ **Real-time Event Tracking** - Track page views, custom events, and user interactions
- ✅ **Beautiful Dashboards** - Stunning visualizations with Chart.js
- ✅ **Privacy-Focused** - GDPR compliant, no cookies required
- ✅ **Multi-Project Support** - Manage multiple websites from one dashboard

### Authentication & Billing
- ✅ **Google OAuth** - Secure authentication with Google Sign-In
- ✅ **Stripe Integration** - Complete payment and subscription management
- ✅ **Tiered Plans** - Free, Personal, and Business plans with usage limits

### Technical Stack
- **Frontend**: Vanilla JavaScript, TailwindCSS, Chart.js
- **Backend**: AWS Lambda (Node.js 18), API Gateway, DynamoDB
- **Infrastructure**: Serverless Framework, CloudFront, S3
- **Auth**: Google OAuth, JWT
- **Payments**: Stripe

## 📋 Architecture

```
Frontend (S3 + CloudFront)
    ↓
API Gateway
    ↓
Lambda Functions
    ↓
DynamoDB Tables
    - Users
    - Projects
    - Events
    - Analytics
```

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Serverless Framework installed: `npm install -g serverless`
- AWS account with appropriate permissions

### SSM Parameters

The following parameters must be set in AWS Systems Manager Parameter Store:

```bash
/snapitanalytics/google/client-id          # Your Google OAuth client ID
/snapitanalytics/google/client-secret      # Your Google OAuth client secret
/snapitanalytics/stripe/secret-key         # Stripe secret key
/snapitanalytics/stripe/publishable-key    # Stripe publishable key
/snapitanalytics/stripe/price-personal-monthly  # Stripe price ID for personal plan
/snapitanalytics/stripe/price-personal-yearly   # Stripe price ID for yearly plan
```

### Backend Deployment

```bash
cd backend
npm install
npm run deploy:prod
```

This will:
1. Install all dependencies
2. Deploy Lambda functions
3. Create DynamoDB tables
4. Set up API Gateway

**Important**: Note the API endpoint URL from the deployment output!

### Frontend Deployment

1. Update `CONFIG.API_URL` in `frontend/app.js` with your API endpoint
2. Run the deployment script:

```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

This will:
1. Upload frontend files to S3
2. Set proper content types
3. Invalidate CloudFront cache

## 💰 Pricing Plans

### Free Plan
- 10,000 events/month
- 3 projects
- 90 days data retention
- Real-time analytics

### Personal Plan ($9/month)
- 100,000 events/month
- 10 projects
- 1 year data retention
- Priority support

### Business Plan ($49/month)
- 1M events/month
- 50 projects
- Unlimited retention
- White-label option

## 🔧 Configuration

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized JavaScript origins:
   - `https://snapitanalytics.com`
   - `https://www.snapitanalytics.com`
6. Add authorized redirect URIs
7. Copy the Client ID and store in SSM Parameter Store

### Stripe Setup
1. Create a [Stripe account](https://stripe.com)
2. Create products and prices for each plan
3. Copy API keys (secret and publishable)
4. Store all credentials in SSM Parameter Store
5. Set up webhook endpoint: `https://your-api-url/billing/webhook`

## 📊 Usage

### Adding Analytics to Your Website

After creating a project, copy the tracking code and add it to your website's `<head>` section:

```html
<!-- SnapIT Analytics -->
<script>
(function() {
  var analytics = window.snapitAnalytics = window.snapitAnalytics || [];
  analytics.projectId = 'YOUR_PROJECT_ID';
  analytics.trackingCode = 'YOUR_TRACKING_CODE';
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
</script>
```

### Custom Event Tracking

Track custom events in your application:

```javascript
// Track button clicks
snapitAnalytics.track('button_click', {
  button: 'signup',
  page: 'homepage'
});

// Track form submissions
snapitAnalytics.track('form_submit', {
  form: 'contact',
  success: true
});

// Track conversions
snapitAnalytics.track('conversion', {
  value: 99.99,
  currency: 'USD',
  product: 'premium_plan'
});
```

## 🔐 Security

- All API endpoints are protected with JWT authentication
- Google OAuth for secure user authentication
- Stripe for PCI-compliant payment processing
- DynamoDB encryption at rest
- HTTPS only (enforced by CloudFront)
- CSP headers configured
- Rate limiting per plan tier

## 📈 Monitoring

### Health Check
```bash
curl https://your-api-url/health
```

### CloudWatch Logs
All Lambda functions log to CloudWatch. View logs:
```bash
cd backend
serverless logs -f functionName -t
```

## 🚧 Development

### Local Development

Backend:
```bash
cd backend
npm install
npm run offline  # Requires serverless-offline plugin
```

Frontend:
```bash
cd frontend
python3 -m http.server 8000
# Open http://localhost:8000
```

### Testing

```bash
cd backend
npm test
```

## 📦 Project Structure

```
.
├── backend/
│   ├── handlers/          # Lambda function handlers
│   │   ├── auth.js        # Google OAuth authentication
│   │   ├── users.js       # User management
│   │   ├── projects.js    # Project management
│   │   ├── analytics.js   # Event tracking and analytics
│   │   ├── billing.js     # Stripe integration
│   │   ├── authorizer.js  # JWT authorizer
│   │   └── health.js      # Health check
│   ├── utils/
│   │   ├── response.js    # HTTP response helpers
│   │   └── jwt.js         # JWT utilities
│   ├── package.json
│   └── serverless.yml     # Infrastructure as code
├── frontend/
│   ├── index.html         # Main HTML file
│   └── app.js             # Frontend application
├── deploy-backend.sh      # Backend deployment script
├── deploy-frontend.sh     # Frontend deployment script
└── README.md
```

## 🐛 Troubleshooting

### "Unauthorized" errors
- Check that JWT token is valid and not expired
- Verify Authorization header is being sent
- Check CloudWatch logs for Lambda authorizer

### Events not being tracked
- Verify tracking code is correctly installed
- Check browser console for CORS errors
- Verify project ID and tracking code match

### Deployment issues
- Ensure AWS CLI is configured correctly
- Verify Serverless Framework is installed
- Check IAM permissions for Lambda, DynamoDB, API Gateway

## 📝 License

MIT License - feel free to use for personal or commercial projects

## 🤝 Support

- Email: support@snapitsoftware.com
- Documentation: https://docs.snapitanalytics.com
- Status: https://status.snapitanalytics.com

## 🎯 Roadmap

- [ ] Custom dashboards and reports
- [ ] Email alerts for anomalies
- [ ] A/B testing integration
- [ ] Funnel analysis
- [ ] Heatmaps
- [ ] Session recordings
- [ ] Mobile SDKs (iOS/Android)
- [ ] Data export (CSV, JSON)
- [ ] Team collaboration features
- [ ] API for programmatic access

---

Made with ❤️ by SnapIT Software
