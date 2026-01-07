/**
 * Email-safe SVG visualizations for customer reports
 * All charts are rendered as inline SVG for maximum email client compatibility
 */

// Brand colors
const COLORS = {
  mint: '#34D399',
  coral: '#FF6B6B',
  gold: '#FBBF24',
  emerald: '#10B981',
  sky: '#38BDF8',
  purple: '#A78BFA',
  rose: '#FB7185',
  slate: '#64748B',
  ink: '#1B1E23',
  muted: '#6B7280',
  background: '#F8FAFC',
  white: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────
// RADIAL GAUGE - Wellness Score (0-100)
// A sleek ring/donut chart with animated-looking gradient
// ─────────────────────────────────────────────────────────────
export function renderRadialGauge(options: {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
}): string {
  const { value, label, sublabel, size = 160 } = options;
  const normalizedValue = Math.max(0, Math.min(100, value));
  
  // Ring geometry
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedValue / 100);
  
  // Color based on score
  const color = normalizedValue >= 85 ? COLORS.mint 
    : normalizedValue >= 70 ? COLORS.gold 
    : COLORS.coral;
  
  const glowColor = normalizedValue >= 85 ? 'rgba(52,211,153,0.3)' 
    : normalizedValue >= 70 ? 'rgba(251,191,36,0.3)' 
    : 'rgba(255,107,107,0.3)';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="padding:16px;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            <!-- Glow effect -->
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <!-- Background ring -->
            <circle 
              cx="${size/2}" cy="${size/2}" r="${radius}"
              fill="none" 
              stroke="${COLORS.background}" 
              stroke-width="${strokeWidth}"
            />
            
            <!-- Progress ring -->
            <circle 
              cx="${size/2}" cy="${size/2}" r="${radius}"
              fill="none" 
              stroke="${color}" 
              stroke-width="${strokeWidth}"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"
              transform="rotate(-90 ${size/2} ${size/2})"
              filter="url(#glow)"
            />
            
            <!-- Center value -->
            <text x="${size/2}" y="${size/2 - 8}" 
              text-anchor="middle" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="32" 
              font-weight="700" 
              fill="${COLORS.ink}">${normalizedValue}</text>
            
            <!-- Label -->
            <text x="${size/2}" y="${size/2 + 14}" 
              text-anchor="middle" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="11" 
              fill="${COLORS.muted}"
              text-transform="uppercase"
              letter-spacing="0.08em">${label}</text>
          </svg>
          ${sublabel ? `<p style="margin:8px 0 0;font-size:13px;color:${color};font-weight:600;">${sublabel}</p>` : ''}
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// BRISTOL SCALE METER
// Visual representation of stool firmness (1-7)
// ─────────────────────────────────────────────────────────────
export function renderBristolScale(options: {
  value: number | null;
  showLabels?: boolean;
}): string {
  const { value, showLabels = true } = options;
  const normalizedValue = value != null ? Math.max(1, Math.min(7, Math.round(value))) : null;
  
  // Bristol scale colors and dots
  const scalePoints = [
    { value: 1, label: 'Hard', color: '#8B4513' },
    { value: 2, label: 'Lumpy', color: '#A0522D' },
    { value: 3, label: 'Cracked', color: '#CD853F' },
    { value: 4, label: 'Ideal', color: COLORS.emerald },
    { value: 5, label: 'Soft', color: '#D4A574' },
    { value: 6, label: 'Mushy', color: '#DEB887' },
    { value: 7, label: 'Liquid', color: '#F5DEB3' },
  ];

  const dotSize = 24;
  const spacing = 36;
  const totalWidth = (scalePoints.length - 1) * spacing + dotSize;
  const height = showLabels ? 80 : 50;

  const dots = scalePoints.map((point, i) => {
    const x = dotSize/2 + i * spacing;
    const isActive = normalizedValue === point.value;
    const isIdeal = point.value === 4;
    
    return `
      <!-- Dot ${point.value} -->
      <circle 
        cx="${x}" cy="20" r="${isActive ? 12 : 10}"
        fill="${point.color}" 
        stroke="${isActive ? COLORS.ink : 'transparent'}"
        stroke-width="${isActive ? 2 : 0}"
        opacity="${normalizedValue === null || isActive ? 1 : 0.4}"
      />
      ${isIdeal ? `<text x="${x}" y="23" text-anchor="middle" font-size="8" fill="${COLORS.white}" font-weight="700">✓</text>` : ''}
      ${showLabels ? `<text x="${x}" y="52" text-anchor="middle" font-size="9" fill="${COLORS.muted}">${point.label}</text>` : ''}
    `;
  }).join('');

  const pointerX = normalizedValue ? dotSize/2 + (normalizedValue - 1) * spacing : null;
  const pointer = pointerX != null ? `
    <polygon 
      points="${pointerX - 6},65 ${pointerX + 6},65 ${pointerX},55" 
      fill="${COLORS.ink}"
    />
  ` : '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="padding:16px 0;">
          <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">Bristol Stool Scale</p>
          <svg width="${totalWidth + 20}" height="${height}" viewBox="-10 0 ${totalWidth + 20} ${height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Track line -->
            <line x1="${dotSize/2}" y1="20" x2="${totalWidth - dotSize/2}" y2="20" stroke="${COLORS.background}" stroke-width="4" stroke-linecap="round"/>
            ${dots}
            ${pointer}
          </svg>
          ${normalizedValue ? `<p style="margin:8px 0 0;font-size:12px;color:${normalizedValue === 4 ? COLORS.emerald : COLORS.muted};">Average: Type ${normalizedValue} (${scalePoints[normalizedValue - 1].label})</p>` : ''}
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART
// For issue breakdowns, comparisons
// ─────────────────────────────────────────────────────────────
export function renderHorizontalBars(options: {
  title?: string;
  items: Array<{ label: string; value: number; color?: string }>;
  maxValue?: number;
  showValues?: boolean;
}): string {
  const { title, items, showValues = true } = options;
  if (!items.length) return '';
  
  const maxValue = options.maxValue ?? Math.max(...items.map(i => i.value), 1);
  const barHeight = 20;
  const labelWidth = 90;
  const barMaxWidth = 160;
  const spacing = 10;
  
  const bars = items.map((item, i) => {
    const barWidth = Math.max(4, (item.value / maxValue) * barMaxWidth);
    const y = i * (barHeight + spacing);
    const color = item.color ?? COLORS.mint;
    
    return `
      <tr>
        <td style="padding:${spacing/2}px 0;vertical-align:middle;width:${labelWidth}px;">
          <span style="font-size:12px;color:${COLORS.muted};">${item.label}</span>
        </td>
        <td style="padding:${spacing/2}px 0;vertical-align:middle;">
          <div style="display:inline-block;width:${barWidth}px;height:${barHeight}px;background:linear-gradient(90deg, ${color}, ${color}dd);border-radius:4px;"></div>
          ${showValues ? `<span style="display:inline-block;margin-left:8px;font-size:13px;font-weight:600;color:${COLORS.ink};">${item.value}</span>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">
      ${title ? `<tr><td colspan="2" style="padding-bottom:12px;"><p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${title}</p></td></tr>` : ''}
      ${bars}
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// DONUT CHART
// For food type breakdown, category distribution
// ─────────────────────────────────────────────────────────────
export function renderDonutChart(options: {
  title?: string;
  items: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}): string {
  const { title, items, size = 120, centerLabel, centerValue } = options;
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) return '';
  
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = items.map((item) => {
    const percentage = item.value / total;
    const dashLength = circumference * percentage;
    const offset = circumference * currentOffset;
    currentOffset += percentage;
    
    return `
      <circle 
        cx="${size/2}" cy="${size/2}" r="${radius}"
        fill="none" 
        stroke="${item.color}" 
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dashLength} ${circumference - dashLength}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${size/2} ${size/2})"
      />
    `;
  }).join('');

  const legend = items.map(item => `
    <tr>
      <td style="padding:4px 8px 4px 0;vertical-align:middle;">
        <div style="width:10px;height:10px;border-radius:50%;background-color:${item.color};"></div>
      </td>
      <td style="padding:4px 0;font-size:12px;color:${COLORS.muted};">${item.label}</td>
      <td style="padding:4px 0 4px 12px;font-size:12px;font-weight:600;color:${COLORS.ink};text-align:right;">${item.value}</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto;">
      ${title ? `<tr><td colspan="2" style="padding-bottom:12px;text-align:center;"><p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${title}</p></td></tr>` : ''}
      <tr>
        <td style="padding-right:20px;vertical-align:middle;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            ${segments}
            ${centerValue ? `
              <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${COLORS.ink}">${centerValue}</text>
              <text x="${size/2}" y="${size/2 + 12}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="${COLORS.muted}">${centerLabel || ''}</text>
            ` : ''}
          </svg>
        </td>
        <td style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            ${legend}
          </table>
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY DOTS CALENDAR
// Shows days with check-ins/activities as dots
// ─────────────────────────────────────────────────────────────
export function renderActivityDots(options: {
  title?: string;
  days: number;
  activeDays: number[];
  color?: string;
}): string {
  const { title, days, activeDays, color = COLORS.mint } = options;
  
  const dotSize = 12;
  const spacing = 4;
  const dotsPerRow = 7;
  const rows = Math.ceil(days / dotsPerRow);
  const totalWidth = dotsPerRow * (dotSize + spacing) - spacing;
  const totalHeight = rows * (dotSize + spacing) - spacing;
  
  const activeDaysSet = new Set(activeDays);
  
  const dots = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const row = Math.floor(i / dotsPerRow);
    const col = i % dotsPerRow;
    const x = col * (dotSize + spacing) + dotSize / 2;
    const y = row * (dotSize + spacing) + dotSize / 2;
    const isActive = activeDaysSet.has(day);
    
    return `
      <circle 
        cx="${x}" cy="${y}" r="${dotSize / 2 - 1}"
        fill="${isActive ? color : COLORS.background}" 
        stroke="${isActive ? color : 'rgba(0,0,0,0.08)'}"
        stroke-width="1"
      />
    `;
  }).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto;">
      ${title ? `<tr><td style="padding-bottom:12px;text-align:center;"><p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${title}</p></td></tr>` : ''}
      <tr>
        <td align="center">
          <svg width="${totalWidth + 10}" height="${totalHeight + 10}" viewBox="-5 -5 ${totalWidth + 10} ${totalHeight + 10}" xmlns="http://www.w3.org/2000/svg">
            ${dots}
          </svg>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;text-align:center;">
          <span style="font-size:13px;font-weight:600;color:${COLORS.ink};">${activeDays.length}</span>
          <span style="font-size:12px;color:${COLORS.muted};"> of ${days} days</span>
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// MINI SPARKLINE
// Small inline trend line
// ─────────────────────────────────────────────────────────────
export function renderSparkline(options: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  showTrend?: boolean;
}): string {
  const { values, width = 80, height = 24, color = COLORS.mint, showTrend = true } = options;
  if (values.length < 2) return '';
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const padding = 2;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * plotWidth;
    const y = padding + plotHeight - ((v - min) / range) * plotHeight;
    return `${x},${y}`;
  }).join(' ');

  // Calculate trend
  const first = values[0];
  const last = values[values.length - 1];
  const trendIcon = last > first ? '↑' : last < first ? '↓' : '→';
  const trendColor = last > first ? COLORS.emerald : last < first ? COLORS.coral : COLORS.muted;

  return `
    <span style="display:inline-flex;align-items:center;gap:6px;">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <polyline 
          points="${points}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <circle cx="${padding + plotWidth}" cy="${padding + plotHeight - ((last - min) / range) * plotHeight}" r="3" fill="${color}"/>
      </svg>
      ${showTrend ? `<span style="font-size:14px;color:${trendColor};">${trendIcon}</span>` : ''}
    </span>
  `;
}

// ─────────────────────────────────────────────────────────────
// STAT CARD WITH ICON
// Modern stat display with icon and optional progress
// ─────────────────────────────────────────────────────────────
export function renderStatCard(options: {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  progress?: number;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}): string {
  const { icon, label, value, sublabel, progress, color = COLORS.mint, trend } = options;
  
  const trendHtml = trend ? `
    <span style="display:inline-block;margin-left:6px;font-size:12px;color:${trend === 'up' ? COLORS.emerald : trend === 'down' ? COLORS.coral : COLORS.muted};">
      ${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
    </span>
  ` : '';

  const progressBar = typeof progress === 'number' ? `
    <div style="margin-top:12px;height:6px;border-radius:999px;background-color:rgba(0,0,0,0.06);overflow:hidden;">
      <div style="height:100%;width:${Math.min(100, Math.max(0, progress))}%;background:linear-gradient(90deg, ${color}, ${color}cc);border-radius:999px;"></div>
    </div>
  ` : '';

  return `
    <td style="padding:8px;vertical-align:top;">
      <div style="border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:18px 20px;background-color:${COLORS.white};box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="display:inline-block;width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg, ${color}22, ${color}11);text-align:center;line-height:32px;font-size:16px;">${icon}</span>
          <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};">${label}</span>
        </div>
        <p style="margin:0;font-size:28px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.02em;">${value}${trendHtml}</p>
        ${sublabel ? `<p style="margin:6px 0 0;font-size:12px;color:${COLORS.muted};">${sublabel}</p>` : ''}
        ${progressBar}
      </div>
    </td>
  `;
}

// ─────────────────────────────────────────────────────────────
// HYDRATION METER
// Visual water drop indicator
// ─────────────────────────────────────────────────────────────
export function renderHydrationMeter(options: {
  level: number; // 0-100
}): string {
  const { level } = options;
  const normalizedLevel = Math.max(0, Math.min(100, level));
  
  const color = normalizedLevel >= 70 ? COLORS.sky 
    : normalizedLevel >= 40 ? COLORS.gold 
    : COLORS.coral;
  
  const label = normalizedLevel >= 70 ? 'Well hydrated' 
    : normalizedLevel >= 40 ? 'Moderate' 
    : 'Low hydration';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;">
      <tr>
        <td align="center">
          <svg width="48" height="60" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Drop outline -->
            <path d="M24 4 C12 20 8 32 8 40 C8 50 15 56 24 56 C33 56 40 50 40 40 C40 32 36 20 24 4Z" 
              fill="${COLORS.background}" 
              stroke="rgba(0,0,0,0.1)" 
              stroke-width="1"/>
            
            <!-- Fill mask -->
            <clipPath id="dropMask">
              <path d="M24 4 C12 20 8 32 8 40 C8 50 15 56 24 56 C33 56 40 50 40 40 C40 32 36 20 24 4Z"/>
            </clipPath>
            
            <!-- Fill level -->
            <rect 
              x="0" y="${56 - (normalizedLevel / 100) * 52}" 
              width="48" height="${(normalizedLevel / 100) * 52}" 
              fill="${color}" 
              clip-path="url(#dropMask)"
              opacity="0.8"
            />
          </svg>
        </td>
      </tr>
      <tr>
        <td style="padding-top:6px;text-align:center;">
          <span style="font-size:11px;color:${color};font-weight:500;">${label}</span>
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// ISSUES BUBBLE CHART
// Visual representation of wellness issues
// ─────────────────────────────────────────────────────────────
export function renderIssuesBubbles(options: {
  issues: Array<{ label: string; count: number }>;
}): string {
  const { issues } = options;
  if (!issues.length) return '';
  
  const maxCount = Math.max(...issues.map(i => i.count));
  
  const bubbles = issues.slice(0, 6).map((issue, i) => {
    const size = 32 + (issue.count / maxCount) * 32;
    const colors = [COLORS.coral, COLORS.gold, COLORS.purple, COLORS.rose, COLORS.sky, COLORS.slate];
    const color = colors[i % colors.length];
    
    return `
      <td style="padding:6px;text-align:center;vertical-align:bottom;">
        <div style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg, ${color}, ${color}bb);box-shadow:0 2px 8px ${color}44;"></div>
        <p style="margin:8px 0 0;font-size:10px;color:${COLORS.muted};white-space:nowrap;">${issue.label}</p>
        <p style="margin:2px 0 0;font-size:12px;font-weight:600;color:${COLORS.ink};">${issue.count}</p>
      </td>
    `;
  }).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto;">
      <tr><td colspan="${issues.length}" style="padding-bottom:12px;text-align:center;"><p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">Issues This Period</p></td></tr>
      <tr>${bubbles}</tr>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// WEEKLY SUMMARY ROW
// Visual row for day-by-day status
// ─────────────────────────────────────────────────────────────
export function renderWeekRow(options: {
  title?: string;
  days: Array<{ label: string; status: 'good' | 'warning' | 'alert' | 'none' }>;
}): string {
  const { title, days } = options;
  
  const statusColors = {
    good: COLORS.emerald,
    warning: COLORS.gold,
    alert: COLORS.coral,
    none: COLORS.background,
  };

  const dayCells = days.map(day => `
    <td style="padding:4px;text-align:center;">
      <div style="width:28px;height:28px;margin:0 auto;border-radius:8px;background-color:${statusColors[day.status]};${day.status === 'none' ? 'border:1px dashed rgba(0,0,0,0.1);' : ''}"></div>
      <p style="margin:4px 0 0;font-size:10px;color:${COLORS.muted};">${day.label}</p>
    </td>
  `).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto;">
      ${title ? `<tr><td colspan="${days.length}" style="padding-bottom:12px;"><p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${title}</p></td></tr>` : ''}
      <tr>${dayCells}</tr>
    </table>
  `;
}

