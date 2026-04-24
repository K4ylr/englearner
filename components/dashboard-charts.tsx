// Pure SVG charts — server-rendered, no client JS, no libs. Sized via
// viewBox so they scale responsively inside their container.

type ActivityPoint = { date: string; newDone: number; reviewDone: number };
type CumulativePoint = { date: string; count: number };

const BAR_W = 12;
const BAR_GAP = 4;
const CHART_H = 140;

export function ActivityBars({ data }: { data: ActivityPoint[] }) {
  const maxTotal = Math.max(
    1,
    ...data.map((d) => d.newDone + d.reviewDone)
  );
  const chartW = data.length * (BAR_W + BAR_GAP) - BAR_GAP;

  return (
    <svg
      viewBox={`0 0 ${chartW} ${CHART_H + 24}`}
      className="w-full h-auto"
      role="img"
      aria-label="每日复习与新学数量"
    >
      {/* gridlines at 1/2 and max */}
      <line
        x1={0}
        x2={chartW}
        y1={CHART_H / 2}
        y2={CHART_H / 2}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeDasharray="2 3"
      />
      <line
        x1={0}
        x2={chartW}
        y1={0}
        y2={0}
        stroke="currentColor"
        strokeOpacity={0.15}
      />

      {data.map((d, i) => {
        const total = d.newDone + d.reviewDone;
        const x = i * (BAR_W + BAR_GAP);
        const totalH = (total / maxTotal) * CHART_H;
        const newH = (d.newDone / maxTotal) * CHART_H;
        const revH = (d.reviewDone / maxTotal) * CHART_H;
        const showTick = i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2);

        return (
          <g key={d.date}>
            {/* review (bottom) */}
            {revH > 0 && (
              <rect
                x={x}
                y={CHART_H - revH}
                width={BAR_W}
                height={revH}
                rx={2}
                className="fill-amber-500"
              />
            )}
            {/* new (stacked on top) */}
            {newH > 0 && (
              <rect
                x={x}
                y={CHART_H - totalH}
                width={BAR_W}
                height={newH}
                rx={2}
                className="fill-[var(--color-brand)]"
              />
            )}
            <title>{`${d.date}  新词 ${d.newDone} · 复习 ${d.reviewDone}`}</title>
            {showTick && (
              <text
                x={x + BAR_W / 2}
                y={CHART_H + 16}
                textAnchor="middle"
                className="fill-[var(--color-fg-muted)]"
                fontSize={10}
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MasteryCurve({ data }: { data: CumulativePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const min = Math.min(0, ...data.map((d) => d.count));
  const rangeY = Math.max(1, max - min);

  const chartW = 600;
  const chartH = CHART_H;

  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * chartW;
    const y = chartH - ((d.count - min) / rangeY) * chartH;
    return { x, y, date: d.date, count: d.count };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    pathD +
    ` L${chartW},${chartH} L0,${chartH} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const growth = data[data.length - 1].count - data[0].count;

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH + 28}`}
      preserveAspectRatio="none"
      className="w-full h-auto"
      role="img"
      aria-label="累计学过的词数"
    >
      <defs>
        <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line
        x1={0}
        x2={chartW}
        y1={chartH}
        y2={chartH}
        stroke="currentColor"
        strokeOpacity={0.15}
      />
      <path d={areaD} fill="url(#masteryFill)" />
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={4} fill="var(--color-brand)" />

      {/* endpoint labels */}
      <text
        x={0}
        y={chartH + 16}
        className="fill-[var(--color-fg-muted)]"
        fontSize={10}
      >
        {first.date.slice(5)}
      </text>
      <text
        x={chartW}
        y={chartH + 16}
        textAnchor="end"
        className="fill-[var(--color-fg-muted)]"
        fontSize={10}
      >
        {last.date.slice(5)}
      </text>
      <text
        x={last.x - 6}
        y={Math.max(last.y - 8, 12)}
        textAnchor="end"
        className="fill-[var(--color-fg)]"
        fontSize={12}
        fontWeight={600}
      >
        {last.count}
      </text>

      <title>{`30 天累计增长 ${growth >= 0 ? "+" : ""}${growth}`}</title>
    </svg>
  );
}
