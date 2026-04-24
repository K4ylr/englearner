// Pure SVG charts — server-rendered, no client JS, no libs.
// Scales via viewBox + w-full so a single size works across breakpoints.

type ActivityPoint = { date: string; newDone: number; reviewDone: number };
type CumulativePoint = { date: string; count: number };

const DAY_MS = 86_400_000;

// ---------- Activity heatmap (GitHub-contribution style) ----------
// 6 columns × 7 rows = 42 cells, enough for 30 days plus some week padding.
// Today sits in the last column; each cell's colour encodes total activity
// (new + review). Empty days stay visible as dim cells so the chart doesn't
// look sparse when the user just started.

const WEEKS = 6;
const ROWS = 7; // Mon..Sun
const CELL = 22;
const GAP = 4;
const LEFT_LABEL_W = 24;
const TOP_LABEL_H = 18;

function dowMondayFirst(iso: string): number {
  // Mon=0 … Sun=6. Parse as UTC so we don't drift by tz.
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  return (d + 6) % 7;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const byDate = new Map<string, ActivityPoint>();
  for (const d of data) byDate.set(d.date, d);

  const todayIso = data[data.length - 1]?.date ?? isoDate(Date.now());
  const todayMs = new Date(todayIso + "T00:00:00Z").getTime();
  const todayRow = dowMondayFirst(todayIso);
  const thisMondayMs = todayMs - todayRow * DAY_MS;
  const windowStartMs =
    new Date(data[0]?.date + "T00:00:00Z").getTime() || todayMs - 29 * DAY_MS;

  const maxTotal = Math.max(
    1,
    ...data.map((d) => d.newDone + d.reviewDone)
  );

  function level(total: number): 0 | 1 | 2 | 3 | 4 {
    if (total <= 0) return 0;
    const pct = total / maxTotal;
    if (pct > 0.75) return 4;
    if (pct > 0.5) return 3;
    if (pct > 0.25) return 2;
    return 1;
  }

  // Tailwind classes per level — brand-tinted opacity scale.
  const FILL: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "fill-[var(--color-border)]",
    1: "fill-[var(--color-brand)]/25",
    2: "fill-[var(--color-brand)]/50",
    3: "fill-[var(--color-brand)]/75",
    4: "fill-[var(--color-brand)]",
  };

  const width = LEFT_LABEL_W + WEEKS * (CELL + GAP) - GAP;
  const height = TOP_LABEL_H + ROWS * (CELL + GAP) - GAP;

  // Build cells. We iterate weeks newest-to-oldest so today ends in the
  // last column. Cells outside the window stay rendered but blank.
  const cells: {
    col: number;
    row: number;
    iso: string;
    inWindow: boolean;
    hit: ActivityPoint | undefined;
  }[] = [];
  for (let col = 0; col < WEEKS; col++) {
    const weekMondayMs = thisMondayMs - (WEEKS - 1 - col) * 7 * DAY_MS;
    for (let row = 0; row < ROWS; row++) {
      const dayMs = weekMondayMs + row * DAY_MS;
      const iso = isoDate(dayMs);
      const inWindow = dayMs <= todayMs && dayMs >= windowStartMs;
      cells.push({ col, row, iso, inWindow, hit: byDate.get(iso) });
    }
  }

  // Month label per column — show the label only when this week crosses
  // into a new month (compared to the previous column).
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < WEEKS; col++) {
    const weekMondayMs = thisMondayMs - (WEEKS - 1 - col) * 7 * DAY_MS;
    const m = new Date(weekMondayMs).getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col, label: `${m + 1} 月` });
      lastMonth = m;
    }
  }

  const dowLabels = ["一", "三", "五"]; // show every other row to avoid clutter

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto max-w-[520px]"
      role="img"
      aria-label="过去一个月的学习活跃度"
    >
      {/* day-of-week labels on the left */}
      {dowLabels.map((d, i) => (
        <text
          key={d}
          x={0}
          y={TOP_LABEL_H + i * 2 * (CELL + GAP) + CELL / 2 + 4}
          className="fill-[var(--color-fg-muted)]"
          fontSize={10}
        >
          周{d}
        </text>
      ))}

      {/* month labels on top */}
      {monthLabels.map(({ col, label }) => (
        <text
          key={col}
          x={LEFT_LABEL_W + col * (CELL + GAP)}
          y={10}
          className="fill-[var(--color-fg-muted)]"
          fontSize={10}
        >
          {label}
        </text>
      ))}

      {cells.map((c) => {
        const total = c.hit ? c.hit.newDone + c.hit.reviewDone : 0;
        const lvl = c.inWindow ? level(total) : 0;
        const x = LEFT_LABEL_W + c.col * (CELL + GAP);
        const y = TOP_LABEL_H + c.row * (CELL + GAP);
        return (
          <g key={`${c.col}-${c.row}`}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={4}
              className={c.inWindow ? FILL[lvl] : "fill-transparent"}
              stroke={c.iso === todayIso ? "var(--color-brand)" : "none"}
              strokeWidth={c.iso === todayIso ? 1.5 : 0}
            />
            {c.inWindow && (
              <title>
                {`${c.iso}${
                  c.hit
                    ? ` · 新词 ${c.hit.newDone} · 复习 ${c.hit.reviewDone}`
                    : " · 休息日"
                }`}
              </title>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Legend for the heatmap ----------
export function HeatmapLegend() {
  const FILL: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "bg-[var(--color-border)]",
    1: "bg-[var(--color-brand)]/25",
    2: "bg-[var(--color-brand)]/50",
    3: "bg-[var(--color-brand)]/75",
    4: "bg-[var(--color-brand)]",
  };
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
      <span>少</span>
      {([0, 1, 2, 3, 4] as const).map((l) => (
        <span
          key={l}
          className={`size-3 rounded-[3px] ${FILL[l]}`}
          aria-hidden
        />
      ))}
      <span>多</span>
    </div>
  );
}

// ---------- Mastery curve (cleaner line + gradient area) ----------
export function MasteryCurve({ data }: { data: CumulativePoint[] }) {
  const chartW = 600;
  const chartH = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.count));
  const min = 0;
  const rangeY = Math.max(1, max - min);

  const points = data.map((d, i) => {
    const x = padL + (i / Math.max(1, data.length - 1)) * innerW;
    const y = padT + (1 - (d.count - min) / rangeY) * innerH;
    return { x, y, date: d.date, count: d.count };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaD = `${pathD} L${points[points.length - 1].x},${padT + innerH} L${padL},${padT + innerH} Z`;

  const last = points[points.length - 1];
  const first = points[0];

  // Y axis ticks: 0, mid, max
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full h-auto"
      role="img"
      aria-label="累计词汇量增长曲线"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis gridlines */}
      {yTicks.map((tick) => {
        const y = padT + (1 - (tick - min) / rangeY) * innerH;
        return (
          <g key={tick}>
            <line
              x1={padL}
              x2={chartW - padR}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={tick === 0 ? 0.2 : 0.08}
              strokeDasharray={tick === 0 ? "" : "2 3"}
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-[var(--color-fg-muted)]"
              fontSize={10}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* area + line */}
      <path d={areaD} fill="url(#masteryFill)" />
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* endpoint dot */}
      <circle
        cx={last.x}
        cy={last.y}
        r={5}
        fill="var(--color-brand)"
        stroke="var(--color-surface)"
        strokeWidth={2}
      />

      {/* date ticks */}
      <text
        x={first.x}
        y={chartH - 6}
        className="fill-[var(--color-fg-muted)]"
        fontSize={10}
      >
        {first.date.slice(5)}
      </text>
      <text
        x={last.x}
        y={chartH - 6}
        textAnchor="end"
        className="fill-[var(--color-fg-muted)]"
        fontSize={10}
      >
        {last.date.slice(5)}
      </text>
    </svg>
  );
}
