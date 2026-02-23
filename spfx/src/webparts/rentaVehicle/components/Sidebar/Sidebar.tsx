import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './Sidebar.module.scss';
import { getVisibleNavItems, INavItem } from './navItems';
import { IUser, AppRole } from '../../models/IUser';

export interface ISidebarProps {
  user: IUser;
  activeKey: string;
  onNavigate: (key: string) => void;
}

const ROLE_COLORS: Record<AppRole, string> = {
  Admin: styles.roleAdmin,
  Manager: styles.roleManager,
  Employee: styles.roleEmployee,
};

export const Sidebar: React.FC<ISidebarProps> = ({ user, activeKey, onNavigate }) => {
  const visibleItems: INavItem[] = getVisibleNavItems(user.role);

  return (
    <nav className={styles.sidebar} role="navigation" aria-label="Main navigation">
      {/* Header */}
      <div className={styles.header}>
        <Icon iconName="Car" className={styles.logo} />
        <span className={styles.appName}>RentAVehicle</span>
      </div>

      {/* Navigation items */}
      <ul className={styles.navList}>
        {visibleItems.map((item: INavItem) => (
          <li key={item.key}>
            <button
              className={`${styles.navItem} ${activeKey === item.key ? styles.active : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={activeKey === item.key ? 'page' : undefined}
              title={item.label}
            >
              <Icon iconName={item.icon} className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Footer with user info and role badge */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.displayName}</span>
          <span className={`${styles.roleBadge} ${ROLE_COLORS[user.role] || ''}`}>
            {user.role}
          </span>
        </div>
      </div>
    </nav>
  );
};
