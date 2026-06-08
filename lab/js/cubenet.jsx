/* global React, CubeEngine */
// 2D unfolded-net view of the cube. Renders 54 sticker squares in the
// classic "cross" layout. Used as a mini-map alongside the 3D view.

const NET_LAYOUT = (() => {
  // Returns array of { idx, gx, gy } where gx,gy are grid positions in a 12x9 grid.
  // Layout:
  //         U
  //   L  F  R  B
  //         D
  // Each face = 3x3 stickers, faces placed at:
  //   U at cols 3..5, rows 0..2
  //   L at cols 0..2, rows 3..5
  //   F at cols 3..5, rows 3..5
  //   R at cols 6..8, rows 3..5
  //   B at cols 9..11, rows 3..5
  //   D at cols 3..5, rows 6..8
  const out = [];
  const place = (offset, face, colStart, rowStart) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      out.push({ idx: offset + r * 3 + c, gx: colStart + c, gy: rowStart + r, face });
    }
  };
  place(0,  'U', 3, 0);
  place(9,  'R', 6, 3);
  place(18, 'F', 3, 3);
  place(27, 'D', 3, 6);
  place(36, 'L', 0, 3);
  place(45, 'B', 9, 3);
  return out;
})();

function CubeNet({ state, onStickerClick, highlightFace, selectedIdx, compact }) {
  const cell = compact ? 14 : 22;
  const gap = compact ? 2 : 3;
  const padding = compact ? 6 : 10;
  const cols = 12, rows = 9;
  const w = cols * cell + (cols - 1) * gap + padding * 2;
  const h = rows * cell + (rows - 1) * gap + padding * 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {NET_LAYOUT.map(({ idx, gx, gy, face }) => {
        const ch = state[idx];
        const fill = CubeEngine.COLORS[ch] || '#222';
        const x = padding + gx * (cell + gap);
        const y = padding + gy * (cell + gap);
        const isHighlight = highlightFace && face === highlightFace;
        const isSelected = selectedIdx === idx;
        const stroke = isSelected ? '#ffffff' : (isHighlight ? '#ffffff' : '#000');
        const strokeW = isSelected ? 2 : (isHighlight ? 1.5 : 0.6);
        return (
          <rect key={idx} x={x} y={y} width={cell} height={cell}
            rx={Math.max(2, cell * 0.18)} ry={Math.max(2, cell * 0.18)}
            fill={fill} stroke={stroke} strokeWidth={strokeW}
            style={{ cursor: onStickerClick ? 'pointer' : 'default' }}
            onClick={onStickerClick ? () => onStickerClick(idx) : undefined} />
        );
      })}
    </svg>
  );
}

window.CubeNet = CubeNet;
