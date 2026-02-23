import { AppRole, hasMinRole } from '../../models/IUser';

export interface INavItem {
  key: string;
  label: string;
  icon: string;
  minRole: AppRole;
}

export const NAV_ITEMS: INavItem[] = [
  { key: 'home', label: 'Home', icon: 'Home', minRole: 'Employee' },
  { key: 'browse', label: 'Browse Vehicles', icon: 'Car', minRole: 'Employee' },
  { key: 'myBookings', label: 'My Bookings', icon: 'Calendar', minRole: 'Employee' },
  { key: 'teamBookings', label: 'Team Bookings', icon: 'People', minRole: 'Manager' },
  { key: 'vehicles', label: 'Manage Vehicles', icon: 'Settings', minRole: 'Admin' },
  { key: 'allBookings', label: 'All Bookings', icon: 'BulletedList', minRole: 'Admin' },
  { key: 'reports', label: 'Reports', icon: 'BarChartVertical', minRole: 'Admin' },
];

export function getVisibleNavItems(userRole: AppRole): INavItem[] {
  return NAV_ITEMS.filter(item => hasMinRole(userRole, item.minRole));
}
