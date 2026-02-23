import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './BottomTabBar.module.scss';
import { getVisibleNavItems, INavItem } from '../Sidebar/navItems';
import { AppRole } from '../../models/IUser';

export interface IBottomTabBarProps {
  userRole: AppRole;
  activeKey: string;
  onNavigate: (key: string) => void;
}

const MAX_VISIBLE_TABS = 4;

export const BottomTabBar: React.FC<IBottomTabBarProps> = ({ userRole, activeKey, onNavigate }) => {
  const allItems: INavItem[] = getVisibleNavItems(userRole);
  const visibleItems = allItems.slice(0, MAX_VISIBLE_TABS - 1);
  const hasMore = allItems.length > MAX_VISIBLE_TABS - 1;

  return (
    <nav className={styles.bottomTabBar} role="navigation" aria-label="Mobile navigation">
      {visibleItems.map((item: INavItem) => (
        <button
          key={item.key}
          className={`${styles.tab} ${activeKey === item.key ? styles.active : ''}`}
          onClick={() => onNavigate(item.key)}
          aria-current={activeKey === item.key ? 'page' : undefined}
          aria-label={item.label}
        >
          <Icon iconName={item.icon} className={styles.tabIcon} />
          <span className={styles.tabLabel}>{item.label}</span>
        </button>
      ))}
      {hasMore && (
        <button
          className={`${styles.tab} ${activeKey === 'more' ? styles.active : ''}`}
          onClick={() => onNavigate('more')}
          aria-label="More"
        >
          <Icon iconName="More" className={styles.tabIcon} />
          <span className={styles.tabLabel}>More</span>
        </button>
      )}
    </nav>
  );
};
