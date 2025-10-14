#!/bin/bash

echo "🚀 Deploying SnapIT Analytics Frontend..."

# S3 bucket name
BUCKET="snapitanalytics.com"

# Sync frontend to S3
echo "📤 Uploading files to S3..."
aws s3 sync frontend/ s3://${BUCKET}/ \
  --exclude ".git/*" \
  --exclude "*.sh" \
  --cache-control "public, max-age=3600"

# Set proper content types
echo "🔧 Setting content types..."
aws s3 cp s3://${BUCKET}/index.html s3://${BUCKET}/index.html \
  --content-type "text/html" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=3600"

aws s3 cp s3://${BUCKET}/app.js s3://${BUCKET}/app.js \
  --content-type "application/javascript" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=3600"

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, '${BUCKET}')].Id" --output text)

if [ -n "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*"
  echo "✅ CloudFront cache invalidated"
else
  echo "⚠️  Could not find CloudFront distribution"
fi

echo ""
echo "✅ Frontend deployment complete!"
echo "🌐 Visit: https://snapitanalytics.com"
