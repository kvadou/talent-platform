import { NextResponse } from 'next/server';

// This endpoint serves the JavaScript embed for Webflow
export async function GET() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://apply.acmetalent.com';

  const jsCode = `
(function() {
  'use strict';

  // Configuration - can be overridden by data attributes on the script tag
  const CONFIG = {
    apiUrl: '${apiBaseUrl}/api/public/jobs/feed',
    containerId: 'acme-jobs',
    market: null, // Filter by market slug if specified
    showDescription: true,
    maxDescriptionLength: 300,
    theme: 'light' // 'light' or 'dark'
  };

  // Get configuration from script tag data attributes
  function getConfig() {
    const script = document.currentScript || document.querySelector('script[src*="embed/jobs.js"]');
    if (script) {
      CONFIG.containerId = script.dataset.container || CONFIG.containerId;
      CONFIG.market = script.dataset.market || CONFIG.market;
      CONFIG.showDescription = script.dataset.showDescription !== 'false';
      CONFIG.theme = script.dataset.theme || CONFIG.theme;
    }
    return CONFIG;
  }

  // Inject styles
  function injectStyles() {
    if (document.getElementById('acme-jobs-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'acme-jobs-styles';
    styles.textContent = \`
      .acme-jobs-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .acme-jobs-loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .acme-jobs-error {
        text-align: center;
        padding: 40px;
        color: #dc2626;
        background: #fef2f2;
        border-radius: 8px;
      }
      .acme-jobs-empty {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .acme-jobs-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .acme-job-card {
        background: #f0f7ff;
        border-radius: 12px;
        padding: 24px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .acme-job-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .acme-job-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1e3a5f;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      .acme-job-location {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #1e3a5f;
        font-size: 0.95rem;
        margin-bottom: 16px;
      }
      .acme-job-location svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .acme-job-description {
        color: #374151;
        font-size: 0.95rem;
        line-height: 1.6;
        margin-bottom: 20px;
      }
      .acme-job-apply-btn {
        display: inline-block;
        background: #f59e0b;
        color: #1e3a5f;
        font-weight: 600;
        padding: 12px 32px;
        border-radius: 50px;
        text-decoration: none;
        font-size: 1rem;
        transition: background 0.2s, transform 0.2s;
      }
      .acme-job-apply-btn:hover {
        background: #d97706;
        transform: scale(1.02);
      }
      .acme-job-meta {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        font-size: 0.85rem;
        color: #6b7280;
      }
    \`;
    document.head.appendChild(styles);
  }

  // Truncate description
  function truncateDescription(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  // Strip HTML tags from description
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  }

  // Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Location icon SVG
  const locationIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';

  // Render job card
  function renderJobCard(job, config) {
    const description = config.showDescription
      ? truncateDescription(stripHtml(job.description), config.maxDescriptionLength)
      : '';

    return \`
      <div class="acme-job-card">
        <h3 class="acme-job-title">\${job.title}</h3>
        <div class="acme-job-location">
          \${locationIcon}
          <span>\${job.location}</span>
        </div>
        \${description ? \`<p class="acme-job-description">\${description}</p>\` : ''}
        <a href="\${job.applyUrl}" class="acme-job-apply-btn" target="_blank" rel="noopener">Apply</a>
        <div class="acme-job-meta">
          <span>Posted \${formatDate(job.postedAt)}</span>
          \${job.market ? \`<span>\${job.market}</span>\` : ''}
        </div>
      </div>
    \`;
  }

  // Main render function
  async function renderJobs() {
    const config = getConfig();
    const container = document.getElementById(config.containerId);

    if (!container) {
      console.error(\`[Acme Jobs] Container #\${config.containerId} not found\`);
      return;
    }

    injectStyles();
    container.classList.add('acme-jobs-container');
    container.innerHTML = '<div class="acme-jobs-loading">Loading open positions...</div>';

    try {
      const url = config.market
        ? \`\${config.apiUrl}?market=\${encodeURIComponent(config.market)}\`
        : config.apiUrl;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(\`Failed to fetch jobs: \${response.status}\`);
      }

      const data = await response.json();
      const jobs = data.jobs || [];

      if (jobs.length === 0) {
        container.innerHTML = '<div class="acme-jobs-empty">No open positions at this time. Check back soon!</div>';
        return;
      }

      container.innerHTML = \`
        <div class="acme-jobs-list">
          \${jobs.map(job => renderJobCard(job, config)).join('')}
        </div>
      \`;

    } catch (error) {
      console.error('[Acme Jobs] Error fetching jobs:', error);
      container.innerHTML = '<div class="acme-jobs-error">Unable to load open positions. Please try again later.</div>';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderJobs);
  } else {
    renderJobs();
  }

  // Expose refresh function globally
  window.AcmeJobs = {
    refresh: renderJobs
  };
})();
`;

  return new NextResponse(jsCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Access-Control-Allow-Origin': '*',
    },
  });
}
