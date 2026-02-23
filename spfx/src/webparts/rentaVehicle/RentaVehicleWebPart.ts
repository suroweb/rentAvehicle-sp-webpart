import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { AadHttpClient } from '@microsoft/sp-http';

import * as strings from 'RentaVehicleWebPartStrings';
import RentaVehicle from './components/RentaVehicle';
import { IRentaVehicleProps } from './components/IRentaVehicleProps';

export interface IRentaVehicleWebPartProps {
  supportContact: string;
}

export default class RentaVehicleWebPart extends BaseClientSideWebPart<IRentaVehicleWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';
  private _apiClient: AadHttpClient | undefined;
  private _isTeams: boolean = false;

  public render(): void {
    const element: React.ReactElement<IRentaVehicleProps> = React.createElement(
      RentaVehicle,
      {
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: this._isTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        userEmail: this.context.pageContext.user.email,
        supportContact: this.properties.supportContact || '',
        apiClient: this._apiClient,
        isTeams: this._isTeams,
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    await super.onInit();

    // Detect Teams context
    this._isTeams = !!this.context.sdks.microsoftTeams;

    // Initialize AadHttpClient for API calls
    try {
      this._apiClient = await this.context.aadHttpClientFactory
        .getClient('api://<azure-functions-app-client-id>');
    } catch (error) {
      console.error('Failed to initialize API client:', error);
      // Will render error state in component
    }

    this._environmentMessage = await this._getEnvironmentMessage();
  }

  private _getEnvironmentMessage(): Promise<string> {
    if (!!this.context.sdks.microsoftTeams) { // running in Teams, office.com or Outlook
      return this.context.sdks.microsoftTeams.teamsJs.app.getContext()
        .then(context => {
          let environmentMessage: string = '';
          switch (context.app.host.name) {
            case 'Office': // running in Office
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOffice : strings.AppOfficeEnvironment;
              break;
            case 'Outlook': // running in Outlook
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOutlook : strings.AppOutlookEnvironment;
              break;
            case 'Teams': // running in Teams
            case 'TeamsModern':
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
              break;
            default:
              environmentMessage = strings.UnknownEnvironment;
          }

          return environmentMessage;
        });
    }

    return Promise.resolve(this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
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
