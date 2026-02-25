import * as React from 'react';
import styles from './BottomSheet.module.scss';

export interface IBottomSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<IBottomSheetProps> = function BottomSheet(props) {
  const isOpen = props.isOpen;
  const onDismiss = props.onDismiss;
  const children = props.children;

  // Track touch start Y for swipe-to-dismiss on drag handle
  const touchStartY = React.useRef<number>(0);

  const handleOverlayClick = React.useCallback(function onOverlayClick(): void {
    onDismiss();
  }, [onDismiss]);

  const handleSheetClick = React.useCallback(function onSheetClick(e: React.MouseEvent): void {
    // Prevent overlay dismiss when clicking inside the sheet
    e.stopPropagation();
  }, []);

  const handleDragTouchStart = React.useCallback(function onDragTouchStart(e: React.TouchEvent): void {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleDragTouchEnd = React.useCallback(function onDragTouchEnd(e: React.TouchEvent): void {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Swipe down more than 80px dismisses the sheet
    if (deltaY > 80) {
      onDismiss();
    }
  }, [onDismiss]);

  // Prevent body scrolling when sheet is open
  React.useEffect(function manageBodyScroll(): () => void {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return function cleanup(): void {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const overlayClassName = isOpen
    ? styles.overlay + ' ' + styles.overlayVisible
    : styles.overlay;

  const sheetClassName = isOpen
    ? styles.sheet + ' ' + styles.sheetOpen
    : styles.sheet;

  return (
    <div className={overlayClassName} onClick={handleOverlayClick}>
      <div className={sheetClassName} onClick={handleSheetClick}>
        <div
          className={styles.dragHandle}
          onTouchStart={handleDragTouchStart}
          onTouchEnd={handleDragTouchEnd}
        />
        {children}
      </div>
    </div>
  );
};
