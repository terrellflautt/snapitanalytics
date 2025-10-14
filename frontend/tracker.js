/**
 * SnapIT Analytics Tracking Script
 * Ultra-lightweight analytics tracker with advanced features
 * Features: Page views, clicks, heat maps, scroll depth, abandoned carts, visit duration
 */
(function() {
  'use strict';

  const config = {
    apiUrl: 'https://api.snapitanalytics.com/track',
    projectId: 'PROJECT_ID',
    trackingCode: 'TRACKING_CODE'
  };

  // Session tracking
  let sessionStartTime = Date.now();
  let lastActivityTime = Date.now();
  let maxScrollDepth = 0;
  let clickCoordinates = [];

  // Generate session ID
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('snapit_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('snapit_session_id', sessionId);
    }
    return sessionId;
  };

  // Get visitor ID (persistent across sessions)
  const getVisitorId = () => {
    let visitorId = localStorage.getItem('snapit_visitor_id');
    if (!visitorId) {
      visitorId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('snapit_visitor_id', visitorId);
    }
    return visitorId;
  };

  // Calculate visit duration
  const getVisitDuration = () => {
    return Math.floor((Date.now() - sessionStartTime) / 1000); // seconds
  };

  // Track event function
  const track = async (eventName, properties = {}) => {
    if (!config.projectId || config.projectId === 'PROJECT_ID') {
      console.warn('[SnapIT Analytics] Invalid project ID. Please configure your tracking code.');
      return;
    }

    const eventData = {
      projectId: config.projectId,
      trackingCode: config.trackingCode,
      event: eventName,
      properties: {
        ...properties,
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        visitDuration: getVisitDuration()
      },
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };

    try {
      // Use sendBeacon for reliability, fallback to fetch
      const payload = JSON.stringify(eventData);

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(config.apiUrl, blob);
      } else {
        fetch(config.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(err => console.error('[SnapIT Analytics] Track error:', err));
      }
    } catch (error) {
      console.error('[SnapIT Analytics] Failed to track event:', error);
    }
  };

  // Auto-track page views
  const trackPageView = () => {
    track('page_view', {
      title: document.title,
      path: window.location.pathname
    });
  };

  // Track page view on load
  if (document.readyState === 'complete') {
    trackPageView();
  } else {
    window.addEventListener('load', trackPageView);
  }

  // Track page views on URL changes (for SPAs)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sessionStartTime = Date.now(); // Reset session start for new page
      maxScrollDepth = 0;
      trackPageView();
    }
  });
  observer.observe(document, { subtree: true, childList: true });

  // Track clicks with coordinates for heat maps
  document.addEventListener('click', (e) => {
    lastActivityTime = Date.now();

    // Calculate relative position (percentage of page)
    const x = e.clientX;
    const y = e.clientY + window.scrollY;
    const relativeX = (x / window.innerWidth) * 100;
    const relativeY = (y / document.documentElement.scrollHeight) * 100;

    // Store click for heat map
    clickCoordinates.push({ x: relativeX, y: relativeY, timestamp: Date.now() });

    const link = e.target.closest('a');
    const button = e.target.closest('button');
    const element = link || button || e.target;

    track('click', {
      element: element.tagName.toLowerCase(),
      text: element.textContent ? element.textContent.trim().substring(0, 100) : '',
      href: link ? link.href : null,
      external: link ? (link.hostname !== window.location.hostname) : false,
      clickX: Math.round(relativeX * 10) / 10,
      clickY: Math.round(relativeY * 10) / 10,
      absoluteX: x,
      absoluteY: y,
      elementPath: getElementPath(element)
    });
  });

  // Get element CSS selector path
  const getElementPath = (element) => {
    if (element.id) return '#' + element.id;
    if (element.className) return element.tagName.toLowerCase() + '.' + element.className.split(' ')[0];
    return element.tagName.toLowerCase();
  };

  // Track outbound links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.hostname !== window.location.hostname) {
      track('outbound_link', {
        destination: link.href,
        text: link.textContent.trim()
      });
    }
  });

  // Scroll depth tracking
  let scrollTimeout;
  const trackScroll = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 100;

      if (scrollPercent > maxScrollDepth) {
        maxScrollDepth = scrollPercent;

        // Track milestones: 25%, 50%, 75%, 100%
        if (scrollPercent >= 25 && scrollPercent < 50 && maxScrollDepth < 50) {
          track('scroll_depth', { depth: 25 });
        } else if (scrollPercent >= 50 && scrollPercent < 75 && maxScrollDepth < 75) {
          track('scroll_depth', { depth: 50 });
        } else if (scrollPercent >= 75 && scrollPercent < 100 && maxScrollDepth < 100) {
          track('scroll_depth', { depth: 75 });
        } else if (scrollPercent >= 100) {
          track('scroll_depth', { depth: 100 });
        }
      }
    }, 150);
  };

  window.addEventListener('scroll', trackScroll, { passive: true });

  // Form tracking
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.tagName === 'FORM') {
      const formData = new FormData(form);
      const fields = Array.from(formData.keys());

      track('form_submit', {
        formId: form.id || 'unknown',
        formAction: form.action || window.location.href,
        fields: fields,
        fieldCount: fields.length
      });
    }
  });

  // Track form field interactions
  let formFocusTracked = {};
  document.addEventListener('focus', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      const fieldId = e.target.id || e.target.name || 'unknown';
      if (!formFocusTracked[fieldId]) {
        formFocusTracked[fieldId] = true;
        track('form_field_focus', {
          field: fieldId,
          type: e.target.type || e.target.tagName.toLowerCase()
        });
      }
    }
  }, true);

  // Session end tracking (before page unload)
  const trackSessionEnd = () => {
    track('session_end', {
      duration: getVisitDuration(),
      maxScrollDepth: maxScrollDepth,
      clicks: clickCoordinates.length,
      inactiveTime: Math.floor((Date.now() - lastActivityTime) / 1000)
    });
  };

  window.addEventListener('beforeunload', trackSessionEnd);
  window.addEventListener('pagehide', trackSessionEnd);

  // Track user inactivity (potential abandonment)
  let inactivityTimer;
  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      track('user_inactive', {
        duration: getVisitDuration(),
        lastActivity: new Date(lastActivityTime).toISOString()
      });
    }, 300000); // 5 minutes of inactivity
  };

  document.addEventListener('mousemove', resetInactivityTimer, { passive: true });
  document.addEventListener('keypress', resetInactivityTimer, { passive: true });
  document.addEventListener('scroll', resetInactivityTimer, { passive: true });
  document.addEventListener('click', resetInactivityTimer);
  resetInactivityTimer();

  // E-commerce tracking helpers
  const trackAddToCart = (product) => {
    track('add_to_cart', {
      product: product.name || product.id,
      price: product.price,
      quantity: product.quantity || 1,
      category: product.category
    });
  };

  const trackRemoveFromCart = (product) => {
    track('remove_from_cart', {
      product: product.name || product.id,
      price: product.price,
      quantity: product.quantity || 1
    });
  };

  const trackCheckoutStarted = (cart) => {
    track('checkout_started', {
      items: cart.items || cart.length,
      total: cart.total,
      currency: cart.currency || 'USD'
    });
  };

  const trackPurchase = (order) => {
    track('purchase', {
      orderId: order.id,
      total: order.total,
      items: order.items || order.itemCount,
      currency: order.currency || 'USD',
      paymentMethod: order.paymentMethod
    });
  };

  const trackAbandonedCart = (cart) => {
    track('cart_abandoned', {
      items: cart.items || cart.length,
      total: cart.total,
      currency: cart.currency || 'USD',
      visitDuration: getVisitDuration()
    });
  };

  // Conversion tracking
  const trackConversion = (conversionName, value = null) => {
    track('conversion', {
      name: conversionName,
      value: value,
      duration: getVisitDuration()
    });
  };

  // Error tracking
  window.addEventListener('error', (e) => {
    track('javascript_error', {
      message: e.message,
      filename: e.filename,
      line: e.lineno,
      column: e.colno
    });
  });

  // Expose public API
  window.snapitAnalytics = {
    track,
    trackPageView,
    getSessionId,
    getVisitorId,
    // E-commerce
    trackAddToCart,
    trackRemoveFromCart,
    trackCheckoutStarted,
    trackPurchase,
    trackAbandonedCart,
    // Conversion
    trackConversion
  };

  console.log('[SnapIT Analytics] Advanced tracker initialized for project:', config.projectId);
})();
