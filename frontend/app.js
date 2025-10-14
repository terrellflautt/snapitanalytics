/**
 * SnapIT Analytics Frontend Application
 */

// Configuration
const CONFIG = {
    API_URL: 'https://api.snapitanalytics.com',
    GOOGLE_CLIENT_ID: '242648112266-l6ckf3312kpaa87smljdprc4jfma1gcm.apps.googleusercontent.com'
};

// State
const STATE = {
    user: null,
    token: null,
    projects: [],
    currentProject: null,
    analytics: null,
    charts: {}
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initGoogleSignIn();
    checkAuth();
});

// Google Sign-In
function initGoogleSignIn() {
    console.log('Initializing Google Sign-In with Client ID:', CONFIG.GOOGLE_CLIENT_ID);

    if (!window.google) {
        console.error('Google Sign-In library not loaded');
        return;
    }

    try {
        window.google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const buttonElement = document.getElementById('google-signin-button');
        if (buttonElement) {
            window.google.accounts.id.renderButton(
                buttonElement,
                {
                    theme: 'filled_blue',
                    size: 'large',
                    text: 'signin_with',
                    width: 300
                }
            );
            console.log('Google Sign-In button rendered');
        } else {
            console.error('Google sign-in button element not found');
        }
    } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
    }
}

async function handleGoogleResponse(response) {
    console.log('Google response received');
    showLoading(true);

    try {
        console.log('Sending credential to backend:', CONFIG.API_URL + '/auth/google');

        const result = await fetch(`${CONFIG.API_URL}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ credential: response.credential })
        });

        console.log('Backend response status:', result.status);
        const data = await result.json();
        console.log('Backend response data:', data);

        if (data.token) {
            console.log('Authentication successful');
            STATE.token = data.token;
            STATE.user = data.user;
            localStorage.setItem('snapit_token', data.token);
            localStorage.setItem('snapit_user', JSON.stringify(data.user));
            showNotification('Welcome, ' + data.user.name + '!', 'success');
            showDashboard();
        } else {
            console.error('No token in response:', data);
            showNotification(data.message || 'Authentication failed', 'error');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showNotification('Authentication failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function checkAuth() {
    const token = localStorage.getItem('snapit_token');
    const user = localStorage.getItem('snapit_user');

    if (token && user) {
        STATE.token = token;
        STATE.user = JSON.parse(user);
        showDashboard();
    }
}

function showDashboard() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('dashboard-app').classList.remove('hidden');

    // Update user info
    document.getElementById('user-name').textContent = STATE.user.name;
    document.getElementById('user-avatar').src = STATE.user.picture;
    document.getElementById('user-plan').textContent = `${STATE.user.plan.charAt(0).toUpperCase() + STATE.user.plan.slice(1)} Plan`;

    loadProjects();
}

function signOut() {
    STATE.user = null;
    STATE.token = null;
    STATE.projects = [];
    STATE.currentProject = null;
    localStorage.removeItem('snapit_token');
    localStorage.removeItem('snapit_user');

    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('dashboard-app').classList.add('hidden');

    location.reload();
}

function showSignIn() {
    document.getElementById('google-signin-button')?.querySelector('div')?.click();
}

// Projects
async function loadProjects() {
    showLoading(true);

    try {
        const response = await fetch(`${CONFIG.API_URL}/projects`, {
            headers: {
                'Authorization': `Bearer ${STATE.token}`
            }
        });

        const data = await response.json();

        if (data.projects) {
            STATE.projects = data.projects;
            renderProjects();
        }
    } catch (error) {
        console.error('Load projects error:', error);
        showNotification('Failed to load projects', 'error');
    } finally {
        showLoading(false);
    }
}

function renderProjects() {
    const container = document.getElementById('projects-list');

    if (STATE.projects.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-6xl mb-4">📊</div>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">No projects yet</h3>
                <p class="text-gray-600 mb-6">Create your first project to start tracking analytics</p>
                <button onclick="showCreateProject()" class="btn-primary text-white px-6 py-3 rounded-xl font-semibold">
                    Create Your First Project
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = STATE.projects.map(project => `
        <div class="bg-white p-6 rounded-xl hover:shadow-lg transition-shadow cursor-pointer" onclick="selectProject('${project.projectId}')">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(project.name)}</h3>
                    <p class="text-sm text-gray-600">${project.domain || 'No domain set'}</p>
                </div>
                <span class="text-2xl">📊</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div class="text-gray-600">Events</div>
                    <div class="font-bold font-mono">${project.stats?.totalEvents || 0}</div>
                </div>
                <div>
                    <div class="text-gray-600">Page Views</div>
                    <div class="font-bold font-mono">${project.stats?.totalPageViews || 0}</div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-xs text-gray-500">Created ${new Date(project.createdAt).toLocaleDateString()}</div>
            </div>
        </div>
    `).join('');
}

function showCreateProject() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <h3 class="text-2xl font-bold text-gray-800 mb-4">Create New Project</h3>
        <form onsubmit="createProject(event)">
            <div class="mb-4">
                <label class="block text-gray-700 font-medium mb-2">Project Name</label>
                <input type="text" id="project-name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-snapit-primary" placeholder="My Awesome Website">
            </div>
            <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2">Domain (optional)</label>
                <input type="text" id="project-domain" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-snapit-primary" placeholder="example.com">
            </div>
            <div class="flex space-x-4">
                <button type="submit" class="flex-1 btn-primary text-white py-3 rounded-xl font-semibold">
                    Create Project
                </button>
                <button type="button" onclick="closeModal()" class="px-6 py-3 text-gray-600 hover:text-gray-800">
                    Cancel
                </button>
            </div>
        </form>
        <div class="mt-4 p-4 bg-blue-50 rounded-lg">
            <div class="text-sm text-gray-700">
                <strong>Free Plan Limit:</strong> ${STATE.user.usage?.projects || 0} / ${STATE.user.limits?.projects || 3} projects used
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function createProject(event) {
    event.preventDefault();
    showLoading(true);

    const name = document.getElementById('project-name').value;
    const domain = document.getElementById('project-domain').value;

    try {
        const response = await fetch(`${CONFIG.API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STATE.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, domain })
        });

        const data = await response.json();

        if (response.ok && data.project) {
            showNotification('Project created successfully!', 'success');
            closeModal();
            loadProjects();
        } else {
            showNotification(data.error || 'Failed to create project', 'error');
        }
    } catch (error) {
        console.error('Create project error:', error);
        showNotification('Failed to create project', 'error');
    } finally {
        showLoading(false);
    }
}

function selectProject(projectId) {
    STATE.currentProject = STATE.projects.find(p => p.projectId === projectId);
    if (STATE.currentProject) {
        showAnalytics();
        loadAnalytics();
        loadTrackingCode();
    }
}

function backToProjects() {
    document.getElementById('projects-section').classList.remove('hidden');
    document.getElementById('analytics-section').classList.add('hidden');
    STATE.currentProject = null;
}

function showAnalytics() {
    document.getElementById('projects-section').classList.add('hidden');
    document.getElementById('analytics-section').classList.remove('hidden');
    document.getElementById('current-project-name').textContent = STATE.currentProject.name;
    document.getElementById('current-project-domain').textContent = STATE.currentProject.domain || 'No domain set';
}

async function loadAnalytics() {
    if (!STATE.currentProject) return;

    showLoading(true);

    const timeRange = document.getElementById('time-range').value;

    try {
        const response = await fetch(`${CONFIG.API_URL}/analytics/${STATE.currentProject.projectId}?timeRange=${timeRange}`, {
            headers: {
                'Authorization': `Bearer ${STATE.token}`
            }
        });

        const data = await response.json();

        if (data.analytics) {
            STATE.analytics = data.analytics;
            renderAnalytics();
        }
    } catch (error) {
        console.error('Load analytics error:', error);
        showNotification('Failed to load analytics', 'error');
    } finally {
        showLoading(false);
    }
}

function renderAnalytics() {
    const analytics = STATE.analytics;

    // Update main stats
    document.getElementById('stat-events').textContent = analytics.totalEvents.toLocaleString();
    document.getElementById('stat-pageviews').textContent = analytics.pageViews.toLocaleString();
    document.getElementById('stat-unique').textContent = analytics.uniqueUrls.toLocaleString();

    const usagePercent = Math.round((STATE.user.usage?.monthlyEvents || 0) / (STATE.user.limits?.events || 10000) * 100);
    document.getElementById('stat-usage').textContent = `${usagePercent}%`;

    // Update key metrics
    document.getElementById('stat-visitors').textContent = (analytics.uniqueVisitors || 0).toLocaleString();

    const duration = analytics.avgVisitDuration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    document.getElementById('stat-duration').textContent = minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    document.getElementById('stat-bounce').textContent = `${analytics.bounceRate || 0}%`;
    document.getElementById('stat-conversions').textContent = (analytics.conversions || 0).toLocaleString();

    // Render charts
    renderEventsChart(analytics.eventsByDay);
    renderBrowserChart(analytics.browsers);

    // Render top pages and referrers
    renderTopPages(analytics.topPages);
    renderTopReferrers(analytics.topReferrers);

    // Render scroll depth
    if (analytics.scrollDepth) {
        document.getElementById('scroll-25').textContent = (analytics.scrollDepth[25] || 0).toLocaleString();
        document.getElementById('scroll-50').textContent = (analytics.scrollDepth[50] || 0).toLocaleString();
        document.getElementById('scroll-75').textContent = (analytics.scrollDepth[75] || 0).toLocaleString();
        document.getElementById('scroll-100').textContent = (analytics.scrollDepth[100] || 0).toLocaleString();
    }

    // Render top clicked elements
    renderTopClickedElements(analytics.topClickedElements);

    // E-commerce stats
    const hasEcommerce = analytics.ecommerce && (
        analytics.ecommerce.addToCart > 0 ||
        analytics.ecommerce.purchases > 0 ||
        analytics.abandonedCarts > 0
    );

    if (hasEcommerce) {
        document.getElementById('ecommerce-section').classList.remove('hidden');
        document.getElementById('ecom-addtocart').textContent = (analytics.ecommerce.addToCart || 0).toLocaleString();
        document.getElementById('ecom-checkout').textContent = (analytics.ecommerce.checkoutStarted || 0).toLocaleString();
        document.getElementById('ecom-purchases').textContent = (analytics.ecommerce.purchases || 0).toLocaleString();
        document.getElementById('ecom-revenue').textContent = `$${(analytics.ecommerce.revenue || 0).toFixed(2)}`;
        document.getElementById('abandoned-carts').textContent = (analytics.abandonedCarts || 0).toLocaleString();
    }

    // Form submissions and errors
    document.getElementById('form-submissions').textContent = (analytics.formSubmissions || 0).toLocaleString();
    document.getElementById('js-errors').textContent = (analytics.errors || 0).toLocaleString();
}

function renderEventsChart(eventsByDay) {
    const ctx = document.getElementById('events-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (STATE.charts.events) {
        STATE.charts.events.destroy();
    }

    const sortedDays = Object.entries(eventsByDay).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sortedDays.map(([day]) => day);
    const data = sortedDays.map(([, count]) => count);

    STATE.charts.events = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Events',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function renderBrowserChart(browsers) {
    const ctx = document.getElementById('browser-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (STATE.charts.browsers) {
        STATE.charts.browsers.destroy();
    }

    const labels = Object.keys(browsers);
    const data = Object.values(browsers);

    STATE.charts.browsers = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#667eea',
                    '#764ba2',
                    '#aa336a',
                    '#f093fb',
                    '#4facfe'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderTopPages(topPages) {
    const container = document.getElementById('top-pages-list');

    if (!topPages || topPages.length === 0) {
        container.innerHTML = '<p class="text-gray-600 text-sm">No page views yet</p>';
        return;
    }

    container.innerHTML = topPages.slice(0, 5).map((page, index) => `
        <div class="flex items-center justify-between py-2 ${index < Math.min(topPages.length, 5) - 1 ? 'border-b border-gray-200' : ''}">
            <div class="flex-1 truncate pr-4">
                <div class="text-sm text-gray-800 truncate">${escapeHtml(page.url)}</div>
            </div>
            <div class="font-mono font-semibold text-blue-600 text-sm">
                ${page.count.toLocaleString()}
            </div>
        </div>
    `).join('');
}

function renderTopReferrers(topReferrers) {
    const container = document.getElementById('top-referrers-list');

    if (!topReferrers || topReferrers.length === 0) {
        container.innerHTML = '<p class="text-gray-600 text-sm">No referrers yet</p>';
        return;
    }

    container.innerHTML = topReferrers.slice(0, 5).map((ref, index) => `
        <div class="flex items-center justify-between py-2 ${index < Math.min(topReferrers.length, 5) - 1 ? 'border-b border-gray-200' : ''}">
            <div class="flex-1 truncate pr-4">
                <div class="text-sm text-gray-800 truncate">${escapeHtml(ref.referrer || 'Direct')}</div>
            </div>
            <div class="font-mono font-semibold text-green-600 text-sm">
                ${ref.count.toLocaleString()}
            </div>
        </div>
    `).join('');
}

function renderTopClickedElements(topClickedElements) {
    const container = document.getElementById('top-clicks-list');

    if (!topClickedElements || topClickedElements.length === 0) {
        container.innerHTML = '<p class="text-gray-600 text-sm">No click data yet</p>';
        return;
    }

    container.innerHTML = topClickedElements.slice(0, 5).map((click, index) => `
        <div class="flex items-center justify-between py-2 ${index < Math.min(topClickedElements.length, 5) - 1 ? 'border-b border-gray-200' : ''}">
            <div class="flex-1 truncate pr-4">
                <div class="text-sm font-mono text-gray-800 truncate">${escapeHtml(click.element)}</div>
            </div>
            <div class="font-mono font-semibold text-purple-600 text-sm">
                ${click.count.toLocaleString()}
            </div>
        </div>
    `).join('');
}

async function loadTrackingCode() {
    if (!STATE.currentProject) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}/projects/${STATE.currentProject.projectId}/tracking-code`, {
            headers: {
                'Authorization': `Bearer ${STATE.token}`
            }
        });

        const data = await response.json();

        if (data.trackingCode) {
            document.getElementById('tracking-code-display').textContent = data.trackingCode;
        }
    } catch (error) {
        console.error('Load tracking code error:', error);
    }
}

function copyTrackingCode() {
    const code = document.getElementById('tracking-code-display').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Tracking code copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy tracking code', 'error');
    });
}

// UI Utilities
function closeModal() {
    const modal = document.getElementById('modal-overlay');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
        loading.classList.add('flex');
    } else {
        loading.classList.add('hidden');
        loading.classList.remove('flex');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    notification.className = `fixed top-6 right-6 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-slide-up`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
