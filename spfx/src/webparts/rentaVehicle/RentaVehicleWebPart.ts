import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { AadHttpClient } from '@microsoft/sp-http';

import { ENV } from './../../config/env.generated';
import { AppShell } from './components/AppShell/AppShell';
import { IAppShellProps } from './components/AppShell/IAppShellProps';

export interface IRentaVehicleWebPartProps {
  supportContact: string;
}

export default class RentaVehicleWebPart extends BaseClientSideWebPart<IRentaVehicleWebPartProps> {

  private _apiClient: AadHttpClient | null = null;
  private _isTeams: boolean = false;
  private _subEntityId: string = '';

  public render(): void {
    const element: React.ReactElement<IAppShellProps> = React.createElement(
      AppShell,
      {
        apiClient: this._apiClient,
        isTeams: this._isTeams,
        initialNav: this._subEntityId || undefined,
        supportContact: this.properties.supportContact || '',
        userDisplayName: this.context.pageContext.user.displayName,
        userEmail: this.context.pageContext.user.email,
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    await super.onInit();

    // Detect Teams context and read subEntityId for deep linking
    this._isTeams = !!this.context.sdks.microsoftTeams;
    if (this._isTeams) {
      try {
        const teamsContext = await this.context.sdks.microsoftTeams!.teamsJs.app.getContext();
        this._subEntityId = teamsContext?.page?.subPageId || '';
      } catch {
        this._subEntityId = '';
      }
    }

    // Initialize AadHttpClient for API calls
    try {
      this._apiClient = await this.context.aadHttpClientFactory
        .getClient(`api://${ENV.AZURE_CLIENT_ID}`);
    } catch (error) {
      console.error('Failed to initialize API client:', error);
      // apiClient remains null -- AuthContext will handle the error state
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: 'RentAVehicle Settings'
          },
          groups: [
            {
              groupName: 'Support',
              groupFields: [
                PropertyPaneTextField('supportContact', {
                  label: 'IT Support Contact',
                  description: 'Email or URL for IT support (shown in error messages)',
                  placeholder: 'itsupport@contoso.com',
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
