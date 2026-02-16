import React from 'react';
import { useDragLayer, XYCoord } from 'react-dnd';
import { DragSource } from '../../typings';
import { useAppSelector } from '../../store';
import { selectDragRotated } from '../../store/inventory';

const GridDragPreview: React.FC = () => {
  const dragRotated = useAppSelector(selectDragRotated);

  const { data, isDragging, currentOffset } = useDragLayer((monitor) => ({
    data: monitor.getItem() as DragSource | null,
    currentOffset: monitor.getClientOffset() as XYCoord | null,
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || !currentOffset || !data?.item) return null;

  const baseW = data.width ?? 1;
  const baseH = data.height ?? 1;
  const effectiveW = dragRotated ? baseH : baseW;
  const effectiveH = dragRotated ? baseW : baseH;

  return (
    <div
      className="grid-drag-preview"
      style={{
        transform: `translate(${currentOffset.x}px, ${currentOffset.y}px) translate(-50%, -50%)`,
        width: `calc(${effectiveW} * var(--cell-size) + ${effectiveW - 1} * var(--grid-gap))`,
        height: `calc(${effectiveH} * var(--cell-size) + ${effectiveH - 1} * var(--grid-gap))`,
      }}
    >
      <div
        className="grid-drag-preview-image"
        style={{
          backgroundImage: data.image,
          transform: dragRotated ? 'rotate(90deg) scale(0.9)' : undefined,
        }}
      />
    </div>
  );
};

export default GridDragPreview;
