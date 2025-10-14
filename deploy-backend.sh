#!/bin/bash

echo "🚀 Deploying SnapIT Analytics Backend..."

cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Deploy to AWS
echo "☁️  Deploying to AWS Lambda..."
npm run deploy:prod

echo "✅ Backend deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Note the API endpoint URL from the deployment output"
echo "2. Update CONFIG.API_URL in frontend/app.js with the new endpoint"
echo "3. Run ./deploy-frontend.sh to deploy the frontend"
