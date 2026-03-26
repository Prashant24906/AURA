const GRID_SIZE = 10;

const TYPE_COLORS = {
  fire: '#FF4757',
  garbage: '#FFA502',
  pothole: '#E5B800',
  parking: '#2ED573',
  traffic: '#00D4FF',
};

// Returns a 10x10 grid of intensity values based on zone data
function buildGrid(zoneData) {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  const maxCount = Math.max(...zoneData.map((d) => d.count), 1);

  zoneData.forEach((d, i) => {
    const row = Math.floor(i / GRID_SIZE) % GRID_SIZE;
    const col = i % GRID_SIZE;
    grid[row][col] = d.count / maxCount;
  });

  return grid;
}

function intensityToColor(intensity) {
  if (intensity === 0) return '#0A0E1A';
  const alpha = Math.max(0.1, intensity);
  return `rgba(0, 212, 255, ${alpha})`;
}

export default function HeatmapPlaceholder({ data = [], title = 'Zone Heatmap' }) {
  // data: [{ zone, count }]
  const grid = buildGrid(data);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gap: 2 }}>
        {grid.map((row, ri) =>
          row.map((val, ci) => (
            <div
              key={`${ri}-${ci}`}
              title={`Intensity: ${(val * 100).toFixed(0)}%`}
              style={{
                height: 20,
                borderRadius: 3,
                background: intensityToColor(val),
                transition: 'background 0.5s ease',
              }}
            />
          ))
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 11, color: '#4A5568' }}>Low density</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map((v) => (
            <div key={v} style={{ width: 14, height: 8, borderRadius: 2, background: intensityToColor(v) }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#00D4FF' }}>High density</span>
      </div>
    </div>
  );
}
