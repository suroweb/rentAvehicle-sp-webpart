import * as React from 'react';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import styles from './StickyBottomBar.module.scss';

export interface IStickyBottomBarProps {
  dateTimeLabel: string;
  onBook: () => void;
}

export const StickyBottomBar: React.FC<IStickyBottomBarProps> = function StickyBottomBar(props) {
  const dateTimeLabel = props.dateTimeLabel;
  const onBook = props.onBook;

  return (
    <div className={styles.stickyBottomBar}>
      <span className={styles.stickyBottomBarText}>{dateTimeLabel}</span>
      <PrimaryButton
        text="Book"
        iconProps={{ iconName: 'EventAccepted' }}
        onClick={onBook}
      />
    </div>
  );
};
