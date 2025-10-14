// Real-time Dashboard Updates for SnapIt Analytics
(function() {
    'use strict';

    class RealtimeDashboard {
        constructor() {
            this.updateInterval = 30000; // 30 seconds
            this.wsConnection = null;
            this.isConnected = false;
            this.retryCount = 0;
            this.maxRetries = 5;
            this.charts = {};
            this.init();
        }

        init() {
            this.setupEventSource();
            this.startPolling();
            this.bindVisibilityChange();
            this.createStatusIndicator();
        }

        setupEventSource() {
            // EventSource disabled - using polling only
            // EventSource doesn't support custom Authorization headers which causes 401 errors
            // Polling provides reliable updates with proper JWT authentication
            console.log('Using polling for real-time updates (more reliable with authentication)');
            // Polling is started in init() so no need to call it again here
        }

        startPolling() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }

            this.pollingInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    this.fetchUpdates();
                }
            }, this.updateInterval);

            // Initial fetch
            this.fetchUpdates();
        }

        async fetchUpdates() {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) return;

                const response = await fetch(`${window.CONFIG?.API_BASE_URL || 'https://api.snapitanalytics.com'}/monitoring/dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.handleRealtimeUpdate(data);
                    this.updateConnectionStatus(true);
                } else {
                    throw new Error('Failed to fetch updates');
                }
            } catch (error) {
                console.error('Failed to fetch real-time updates:', error);
                this.updateConnectionStatus(false);
                this.handleRetry();
            }
        }

        handleRealtimeUpdate(data) {
            if (data.metrics) {
                this.updateMetrics(data.metrics);
            }
            
            if (data.liveVisitors) {
                this.updateLiveVisitors(data.liveVisitors);
            }

            if (data.recentEvents) {
                this.updateRecentEvents(data.recentEvents);
            }

            // Update timestamp
            this.updateLastUpdateTime();
        }

        updateMetrics(metrics) {
            // Update stat cards
            const elements = {
                'pageViewsCount': metrics.totalPageViews || 0,
                'visitorsCount': metrics.uniqueVisitors || 0,
                'sessionsCount': metrics.totalSessions || 0,
                'conversionRate': `${metrics.conversionRate || 0}%`
            };

            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    // Animate number changes
                    this.animateNumberChange(element, value);
                }
            });

            // Update change indicators
            this.updateChangeIndicators(metrics);
        }

        animateNumberChange(element, newValue) {
            const currentValue = element.textContent.replace(/[^\d.-]/g, '');
            const numericCurrent = parseFloat(currentValue) || 0;
            const numericNew = typeof newValue === 'string' ? 
                parseFloat(newValue.replace(/[^\d.-]/g, '')) || 0 : newValue;

            if (numericCurrent !== numericNew) {
                element.style.transform = 'scale(1.1)';
                element.style.color = '#2563eb';
                
                setTimeout(() => {
                    element.textContent = typeof newValue === 'number' ? 
                        newValue.toLocaleString() : newValue;
                    element.style.transform = 'scale(1)';
                    element.style.color = '';
                }, 150);
            }
        }

        updateChangeIndicators(metrics) {
            const changes = {
                'pageViewsChange': metrics.pageViewsChange || 0,
                'visitorsChange': metrics.visitorsChange || 0,
                'sessionsChange': metrics.sessionsChange || 0,
                'conversionChange': metrics.conversionChange || 0
            };

            Object.entries(changes).forEach(([id, change]) => {
                const element = document.getElementById(id);
                if (element) {
                    const isPositive = change >= 0;
                    element.textContent = `${isPositive ? '+' : ''}${change}%`;
                    element.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
                }
            });
        }

        updateLiveVisitors(count) {
            // Create or update live visitors indicator
            let indicator = document.getElementById('liveVisitors');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'liveVisitors';
                indicator.className = 'live-visitors-indicator';
                indicator.innerHTML = `
                    <div class="live-dot"></div>
                    <span class="live-count">0</span>
                    <span class="live-label">online now</span>
                `;
                
                // Add to header
                const header = document.querySelector('.dashboard-header');
                if (header) {
                    header.appendChild(indicator);
                }
            }

            const countElement = indicator.querySelector('.live-count');
            if (countElement) {
                this.animateNumberChange(countElement, count);
            }
        }

        updateRecentEvents(events) {
            const container = document.getElementById('recentEvents');
            if (!container) {
                this.createRecentEventsWidget();
                return;
            }

            const eventsHtml = events.slice(0, 5).map(event => `
                <div class="recent-event">
                    <div class="event-icon">
                        ${this.getEventIcon(event.eventType)}
                    </div>
                    <div class="event-details">
                        <div class="event-title">${event.eventType}</div>
                        <div class="event-meta">${event.url} • ${this.formatTime(event.timestamp)}</div>
                    </div>
                    <div class="event-location">${event.country || 'Unknown'}</div>
                </div>
            `).join('');

            container.innerHTML = eventsHtml || '<p class="no-events">No recent events</p>';
        }

        createRecentEventsWidget() {
            const widget = document.createElement('div');
            widget.className = 'realtime-widget';
            widget.innerHTML = `
                <h3>Recent Activity</h3>
                <div id="recentEvents" class="recent-events-list">
                    <p class="no-events">Loading recent events...</p>
                </div>
            `;

            // Add to dashboard
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.appendChild(widget);
            }
        }

        getEventIcon(eventType) {
            const icons = {
                'page_view': '👁️',
                'click': '👆',
                'form_submit': '📝',
                'purchase': '🛒',
                'signup': '✨',
                'download': '⬇️'
            };
            return icons[eventType] || '📊';
        }

        formatTime(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            
            if (diff < 60000) return 'just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return `${Math.floor(diff / 86400000)}d ago`;
        }

        createStatusIndicator() {
            const indicator = document.createElement('div');
            indicator.id = 'connectionStatus';
            indicator.className = 'connection-status';
            indicator.innerHTML = `
                <div class="status-dot"></div>
                <span class="status-text">Connecting...</span>
                <div class="last-update">Never</div>
            `;

            // Add CSS for status indicator
            const styles = `
                <style>
                .connection-status {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: white;
                    padding: 10px 15px;
                    border-radius: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    z-index: 1000;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #fbbf24;
                    animation: pulse 2s infinite;
                }

                .status-dot.connected {
                    background: #10b981;
                }

                .status-dot.disconnected {
                    background: #ef4444;
                    animation: none;
                }

                .status-text {
                    font-weight: 500;
                    color: #374151;
                }

                .last-update {
                    color: #6b7280;
                    font-size: 0.75rem;
                }

                .live-visitors-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                }

                .live-dot {
                    width: 6px;
                    height: 6px;
                    background: #10b981;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .live-count {
                    font-weight: 600;
                    color: #10b981;
                }

                .live-label {
                    color: #6b7280;
                }

                .realtime-widget {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin-top: 2rem;
                }

                .recent-events-list {
                    max-height: 300px;
                    overflow-y: auto;
                }

                .recent-event {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                    border-bottom: 1px solid #f3f4f6;
                }

                .recent-event:last-child {
                    border-bottom: none;
                }

                .event-icon {
                    font-size: 1.2rem;
                }

                .event-details {
                    flex: 1;
                }

                .event-title {
                    font-weight: 500;
                    color: #374151;
                }

                .event-meta {
                    font-size: 0.8rem;
                    color: #6b7280;
                }

                .event-location {
                    font-size: 0.8rem;
                    color: #6b7280;
                    background: #f3f4f6;
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                </style>
            `;

            document.head.insertAdjacentHTML('beforeend', styles);
            document.body.appendChild(indicator);
        }

        updateConnectionStatus(connected) {
            const indicator = document.getElementById('connectionStatus');
            if (!indicator) return;

            const dot = indicator.querySelector('.status-dot');
            const text = indicator.querySelector('.status-text');

            if (connected) {
                dot.className = 'status-dot connected';
                text.textContent = 'Live';
                this.retryCount = 0;
            } else {
                dot.className = 'status-dot disconnected';
                text.textContent = 'Reconnecting...';
            }
        }

        updateLastUpdateTime() {
            const indicator = document.getElementById('connectionStatus');
            if (!indicator) return;

            const lastUpdate = indicator.querySelector('.last-update');
            if (lastUpdate) {
                lastUpdate.textContent = new Date().toLocaleTimeString();
            }
        }

        handleRetry() {
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => {
                    this.fetchUpdates();
                }, Math.pow(2, this.retryCount) * 1000); // Exponential backoff
            }
        }

        bindVisibilityChange() {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Resume updates when tab becomes visible
                    this.fetchUpdates();
                    if (!this.pollingInterval) {
                        this.startPolling();
                    }
                } else {
                    // Pause updates when tab is hidden
                    if (this.pollingInterval) {
                        clearInterval(this.pollingInterval);
                        this.pollingInterval = null;
                    }
                }
            });
        }

        destroy() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
            if (this.eventSource) {
                this.eventSource.close();
            }
        }
    }

    // Initialize real-time dashboard when on dashboard page
    if (window.location.pathname.includes('dashboard') || document.getElementById('trafficChart')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.realtimeDashboard = new RealtimeDashboard();
            });
        } else {
            window.realtimeDashboard = new RealtimeDashboard();
        }
    }

})();