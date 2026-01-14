/**
 * Navigation UI for hierarchical network diagrams
 * Provides breadcrumb, tabs, and back button for sheet navigation
 */

/**
 * Navigation state for hierarchical diagrams
 */
export interface NavigationState {
  /**
   * Current sheet ID (undefined = root)
   */
  currentSheet?: string

  /**
   * Breadcrumb path from root to current sheet
   */
  breadcrumb: string[]

  /**
   * Available sheets
   */
  sheets: Map<string, SheetInfo>
}

/**
 * Information about a sheet
 */
export interface SheetInfo {
  id: string
  label: string
  parentId?: string
}

/**
 * Generate breadcrumb HTML
 */
export function generateBreadcrumb(state: NavigationState): string {
  const items = state.breadcrumb.map((id, index) => {
    const isLast = index === state.breadcrumb.length - 1
    const label = id === 'root' ? 'Overview' : (state.sheets.get(id)?.label ?? id)

    if (isLast) {
      return `<span class="breadcrumb-current">${escapeHtml(label)}</span>`
    }

    return `<button class="breadcrumb-item" data-sheet="${escapeHtml(id)}">${escapeHtml(label)}</button>`
  })

  return `<nav class="breadcrumb">${items.join('<span class="breadcrumb-sep">/</span>')}</nav>`
}

/**
 * Generate tab navigation HTML for sibling sheets
 */
export function generateTabs(state: NavigationState, siblingIds: string[]): string {
  if (siblingIds.length <= 1) return ''

  const tabs = siblingIds.map((id) => {
    const info = state.sheets.get(id)
    const label = info?.label ?? id
    const isActive = id === state.currentSheet

    return `<button class="tab ${isActive ? 'active' : ''}" data-sheet="${escapeHtml(id)}">${escapeHtml(label)}</button>`
  })

  return `<div class="tabs">${tabs.join('')}</div>`
}

/**
 * Generate back button HTML
 */
export function generateBackButton(state: NavigationState): string {
  if (state.breadcrumb.length <= 1) return ''

  const parentId = state.breadcrumb[state.breadcrumb.length - 2]
  const parentLabel =
    parentId === 'root' ? 'Overview' : (state.sheets.get(parentId)?.label ?? parentId)

  return `<button class="back-btn" data-sheet="${escapeHtml(parentId)}">
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
    </svg>
    ${escapeHtml(parentLabel)}
  </button>`
}

/**
 * Generate complete navigation toolbar HTML
 */
export function generateNavigationToolbar(
  state: NavigationState,
  siblingIds: string[] = [],
): string {
  const breadcrumb = generateBreadcrumb(state)
  const backBtn = generateBackButton(state)
  const tabs = generateTabs(state, siblingIds)

  return `<div class="nav-toolbar">
    <div class="nav-row">
      ${backBtn}
      ${breadcrumb}
    </div>
    ${tabs}
  </div>`
}

/**
 * Get CSS styles for navigation components
 */
export function getNavigationStyles(): string {
  return `
    .nav-toolbar {
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid #e5e5e5;
    }
    .nav-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border: 1px solid #e5e5e5;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #555;
      transition: all 0.15s;
    }
    .back-btn:hover {
      background: #f5f5f5;
      border-color: #ccc;
    }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }
    .breadcrumb-item {
      background: none;
      border: none;
      color: #0066cc;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .breadcrumb-item:hover {
      background: #f0f7ff;
    }
    .breadcrumb-current {
      color: #333;
      font-weight: 500;
    }
    .breadcrumb-sep {
      color: #999;
    }
    .tabs {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 0;
    }
    .tab {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 13px;
      color: #666;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all 0.15s;
    }
    .tab:hover {
      color: #333;
      background: #f5f5f5;
    }
    .tab.active {
      color: #0066cc;
      border-bottom-color: #0066cc;
      font-weight: 500;
    }
  `
}

/**
 * Get JavaScript code for navigation event handling
 */
export function getNavigationScript(): string {
  return `
    (function() {
      function navigateToSheet(sheetId) {
        // Dispatch custom event for sheet navigation
        var event = new CustomEvent('shumoku:navigate', {
          detail: { sheetId: sheetId },
          bubbles: true
        });
        document.dispatchEvent(event);
      }

      // Handle breadcrumb clicks
      document.querySelectorAll('.breadcrumb-item').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sheetId = this.getAttribute('data-sheet');
          if (sheetId) navigateToSheet(sheetId);
        });
      });

      // Handle back button clicks
      document.querySelectorAll('.back-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sheetId = this.getAttribute('data-sheet');
          if (sheetId) navigateToSheet(sheetId);
        });
      });

      // Handle tab clicks
      document.querySelectorAll('.tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sheetId = this.getAttribute('data-sheet');
          if (sheetId) navigateToSheet(sheetId);
        });
      });
    })();
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
