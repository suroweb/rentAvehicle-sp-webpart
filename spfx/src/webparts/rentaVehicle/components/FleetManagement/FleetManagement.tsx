import * as React from 'react';
import { ApiService } from '../../services/ApiService';

export interface IFleetManagementProps {
  apiService: ApiService;
}

/**
 * Fleet Management page -- placeholder for Task 1 compilation.
 * Full implementation in Task 2.
 */
export const FleetManagement: React.FC<IFleetManagementProps> = () => {
  return (
    <div>
      <h2>Fleet Management</h2>
      <p>Loading fleet management...</p>
    </div>
  );
};
