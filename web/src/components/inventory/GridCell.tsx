import React from 'react';

interface GridCellProps {
  x: number;
  y: number;
}

const GridCell: React.FC<GridCellProps> = ({ x, y }) => {
  return (
    <div
      className="grid-cell"
      style={{
        gridColumn: x + 1,
        gridRow: y + 1,
      }}
    />
  );
};

export default React.memo(GridCell);
