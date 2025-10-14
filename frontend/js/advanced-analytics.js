// Advanced Analytics Features for SnapIt Analytics
(function() {
    'use strict';

    class AdvancedAnalytics {
        constructor() {
            this.heatmapData = [];
            this.sessionRecordings = [];
            this.funnelData = [];
            this.cohortData = [];
            this.init();
        }

        init() {
            this.createAdvancedWidgets();
            this.loadAdvancedData();
            this.bindEvents();
        }

        createAdvancedWidgets() {
            const container = document.querySelector('.main-content');
            if (!container) return;

            // Create advanced analytics section
            const advancedSection = document.createElement('div');
            advancedSection.className = 'advanced-analytics-section';
            advancedSection.innerHTML = `
                <div class="section-header">
                    <h2>Advanced Analytics</h2>
                    <div class="analytics-tabs">
                        <button class="tab-btn active" data-tab="heatmap">Heatmaps</button>
                        <button class="tab-btn" data-tab="funnel">Funnels</button>
                        <button class="tab-btn" data-tab="cohort">Cohorts</button>
                        <button class="tab-btn" data-tab="sessions">Sessions</button>
                    </div>
                </div>

                <div class="tab-content">
                    <div id="heatmap-tab" class="tab-pane active">
                        <div class="heatmap-controls">
                            <select id="heatmapType">
                                <option value="click">Click Heatmap</option>
                                <option value="scroll">Scroll Heatmap</option>
                                <option value="move">Mouse Movement</option>
                            </select>
                            <select id="heatmapPage">
                                <option value="all">All Pages</option>
                            </select>
                            <button class="btn btn-primary" onclick="advancedAnalytics.generateHeatmap()">
                                Generate Heatmap
                            </button>
                        </div>
                        <div id="heatmapContainer" class="heatmap-container">
                            <div class="placeholder">
                                <i class="fas fa-fire"></i>
                                <p>Select options and click "Generate Heatmap" to visualize user interactions</p>
                            </div>
                        </div>
                    </div>

                    <div id="funnel-tab" class="tab-pane">
                        <div class="funnel-builder">
                            <h3>Conversion Funnel Analysis</h3>
                            <div class="funnel-steps">
                                <div class="funnel-step">
                                    <div class="step-number">1</div>
                                    <div class="step-content">
                                        <h4>Landing Page Visit</h4>
                                        <div class="step-metrics">
                                            <span class="metric-value">2,547</span>
                                            <span class="metric-label">visitors</span>
                                        </div>
                                    </div>
                                    <div class="conversion-rate">100%</div>
                                </div>
                                <div class="funnel-arrow">▼</div>
                                <div class="funnel-step">
                                    <div class="step-number">2</div>
                                    <div class="step-content">
                                        <h4>Sign Up Started</h4>
                                        <div class="step-metrics">
                                            <span class="metric-value">1,234</span>
                                            <span class="metric-label">visitors</span>
                                        </div>
                                    </div>
                                    <div class="conversion-rate">48.4%</div>
                                </div>
                                <div class="funnel-arrow">▼</div>
                                <div class="funnel-step">
                                    <div class="step-number">3</div>
                                    <div class="step-content">
                                        <h4>Sign Up Completed</h4>
                                        <div class="step-metrics">
                                            <span class="metric-value">892</span>
                                            <span class="metric-label">visitors</span>
                                        </div>
                                    </div>
                                    <div class="conversion-rate">72.3%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="cohort-tab" class="tab-pane">
                        <div class="cohort-analysis">
                            <h3>User Retention Cohorts</h3>
                            <div class="cohort-table">
                                <div class="cohort-header">
                                    <div class="cohort-period">Cohort</div>
                                    <div class="cohort-size">Size</div>
                                    <div class="retention-period">Day 1</div>
                                    <div class="retention-period">Day 7</div>
                                    <div class="retention-period">Day 30</div>
                                </div>
                                <div class="cohort-row">
                                    <div class="cohort-period">Jan 2025</div>
                                    <div class="cohort-size">1,247</div>
                                    <div class="retention-rate high">84%</div>
                                    <div class="retention-rate medium">62%</div>
                                    <div class="retention-rate low">34%</div>
                                </div>
                                <div class="cohort-row">
                                    <div class="cohort-period">Dec 2024</div>
                                    <div class="cohort-size">956</div>
                                    <div class="retention-rate high">79%</div>
                                    <div class="retention-rate medium">58%</div>
                                    <div class="retention-rate low">31%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="sessions-tab" class="tab-pane">
                        <div class="session-recordings">
                            <h3>Session Recordings</h3>
                            <div class="sessions-list">
                                <div class="session-item">
                                    <div class="session-preview">
                                        <div class="session-thumbnail">📹</div>
                                        <div class="session-info">
                                            <h4>User Session #1234</h4>
                                            <p>5m 23s • 14 clicks • Converted</p>
                                            <span class="session-date">2 hours ago</span>
                                        </div>
                                    </div>
                                    <div class="session-actions">
                                        <button class="btn btn-secondary">Watch</button>
                                        <button class="btn btn-primary">Analyze</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(advancedSection);
            this.addAdvancedStyles();
        }

        addAdvancedStyles() {
            const styles = `
                <style>
                .advanced-analytics-section {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin: 2rem 0;
                    overflow: hidden;
                }

                .section-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .analytics-tabs {
                    display: flex;
                    gap: 1rem;
                }

                .tab-btn {
                    padding: 0.5rem 1rem;
                    background: none;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tab-btn.active {
                    background: #2563eb;
                    color: white;
                    border-color: #2563eb;
                }

                .tab-content {
                    padding: 1.5rem;
                }

                .tab-pane {
                    display: none;
                }

                .tab-pane.active {
                    display: block;
                }

                .heatmap-controls {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    align-items: center;
                }

                .heatmap-controls select {
                    padding: 0.5rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                }

                .heatmap-container {
                    min-height: 400px;
                    border: 2px dashed #d1d5db;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .placeholder {
                    text-align: center;
                    color: #6b7280;
                }

                .placeholder i {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    color: #d1d5db;
                }

                .funnel-steps {
                    max-width: 600px;
                    margin: 0 auto;
                }

                .funnel-step {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.5rem;
                    background: #f9fafb;
                    border-radius: 8px;
                    margin-bottom: 0.5rem;
                }

                .step-number {
                    width: 40px;
                    height: 40px;
                    background: #2563eb;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .step-content {
                    flex: 1;
                }

                .step-content h4 {
                    margin: 0 0 0.5rem 0;
                }

                .metric-value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #1f2937;
                }

                .metric-label {
                    color: #6b7280;
                    margin-left: 0.5rem;
                }

                .conversion-rate {
                    font-size: 1.25rem;
                    font-weight: bold;
                    color: #059669;
                }

                .funnel-arrow {
                    text-align: center;
                    font-size: 1.5rem;
                    color: #6b7280;
                    margin: 0.5rem 0;
                }

                .cohort-table {
                    overflow-x: auto;
                }

                .cohort-header,
                .cohort-row {
                    display: grid;
                    grid-template-columns: 120px 80px repeat(3, 80px);
                    gap: 1rem;
                    padding: 1rem;
                    border-bottom: 1px solid #e5e7eb;
                }

                .cohort-header {
                    background: #f9fafb;
                    font-weight: bold;
                }

                .retention-rate {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    text-align: center;
                    font-weight: bold;
                }

                .retention-rate.high {
                    background: #d1fae5;
                    color: #065f46;
                }

                .retention-rate.medium {
                    background: #fef3c7;
                    color: #92400e;
                }

                .retention-rate.low {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .sessions-list {
                    space-y: 1rem;
                }

                .session-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }

                .session-preview {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .session-thumbnail {
                    font-size: 2rem;
                    width: 60px;
                    height: 60px;
                    background: #f3f4f6;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .session-info h4 {
                    margin: 0 0 0.25rem 0;
                }

                .session-info p {
                    margin: 0;
                    color: #6b7280;
                }

                .session-date {
                    font-size: 0.8rem;
                    color: #9ca3af;
                }

                .session-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                </style>
            `;
            document.head.insertAdjacentHTML('beforeend', styles);
        }

        bindEvents() {
            // Tab switching
            document.addEventListener('click', (e) => {
                if (e.target.matches('.tab-btn')) {
                    this.switchTab(e.target.dataset.tab);
                }
            });
        }

        switchTab(tabName) {
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

            // Update active tab pane
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');

            // Load tab-specific data
            this.loadTabData(tabName);
        }

        async loadTabData(tabName) {
            switch (tabName) {
                case 'heatmap':
                    this.loadHeatmapData();
                    break;
                case 'funnel':
                    this.loadFunnelData();
                    break;
                case 'cohort':
                    this.loadCohortData();
                    break;
                case 'sessions':
                    this.loadSessionData();
                    break;
            }
        }

        async loadAdvancedData() {
            // Load initial data for all tabs
            await Promise.all([
                this.loadHeatmapData(),
                this.loadFunnelData(),
                this.loadCohortData(),
                this.loadSessionData()
            ]);
        }

        async loadHeatmapData() {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) return;

                // This would typically fetch from your API
                const response = await fetch(`${window.CONFIG?.API_BASE_URL || 'https://api.snapitanalytics.com'}/analytics/heatmap`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.heatmapData = data.heatmap || [];
                }
            } catch (error) {
                console.error('Failed to load heatmap data:', error);
                // Use mock data for demo
                this.heatmapData = this.generateMockHeatmapData();
            }
        }

        generateHeatmap() {
            const container = document.getElementById('heatmapContainer');
            const type = document.getElementById('heatmapType').value;
            
            container.innerHTML = `
                <div class="heatmap-visualization">
                    <div class="heatmap-legend">
                        <span>Less</span>
                        <div class="legend-gradient"></div>
                        <span>More</span>
                    </div>
                    <div class="heatmap-canvas">
                        <canvas id="heatmapCanvas" width="800" height="600"></canvas>
                    </div>
                    <div class="heatmap-stats">
                        <div class="stat">
                            <span class="stat-label">Total ${type}s:</span>
                            <span class="stat-value">2,547</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Unique users:</span>
                            <span class="stat-value">1,234</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Avg per user:</span>
                            <span class="stat-value">2.1</span>
                        </div>
                    </div>
                </div>
            `;

            // Initialize heatmap visualization
            this.renderHeatmap(type);
        }

        renderHeatmap(type) {
            const canvas = document.getElementById('heatmapCanvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Generate mock heatmap points
            const points = this.generateMockHeatmapData();
            
            points.forEach(point => {
                const intensity = point.intensity || 0.5;
                const radius = 30;
                
                // Create radial gradient
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, radius
                );
                
                gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity})`);
                gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    point.x - radius,
                    point.y - radius,
                    radius * 2,
                    radius * 2
                );
            });
        }

        generateMockHeatmapData() {
            const points = [];
            for (let i = 0; i < 20; i++) {
                points.push({
                    x: Math.random() * 800,
                    y: Math.random() * 600,
                    intensity: Math.random()
                });
            }
            return points;
        }

        async loadFunnelData() {
            // Mock funnel data - in real implementation, fetch from API
            this.funnelData = [
                { step: 'Landing Page', users: 2547, rate: 100 },
                { step: 'Sign Up Started', users: 1234, rate: 48.4 },
                { step: 'Sign Up Completed', users: 892, rate: 72.3 }
            ];
        }

        async loadCohortData() {
            // Mock cohort data
            this.cohortData = [
                { period: 'Jan 2025', size: 1247, day1: 84, day7: 62, day30: 34 },
                { period: 'Dec 2024', size: 956, day1: 79, day7: 58, day30: 31 }
            ];
        }

        async loadSessionData() {
            // Mock session data
            this.sessionRecordings = [
                { id: 1234, duration: '5m 23s', clicks: 14, converted: true, date: '2 hours ago' }
            ];
        }
    }

    // Export for global access
    window.AdvancedAnalytics = AdvancedAnalytics;

    // Initialize when on dashboard
    if (document.querySelector('.dashboard-layout') || window.location.pathname.includes('dashboard')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.advancedAnalytics = new AdvancedAnalytics();
            });
        } else {
            window.advancedAnalytics = new AdvancedAnalytics();
        }
    }

})();