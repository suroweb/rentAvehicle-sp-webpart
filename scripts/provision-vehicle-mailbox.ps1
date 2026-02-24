<#
.SYNOPSIS
    Provisions an Exchange Online equipment mailbox for a RentAVehicle vehicle.

.DESCRIPTION
    This script creates an Exchange Online equipment mailbox for a vehicle,
    configures calendar processing to only accept bookings from the app service account,
    grants all organization users Reviewer access to the vehicle calendar,
    and optionally adds the mailbox to a room list distribution group for location grouping.

    After running this script, copy the generated email address and set it on the vehicle
    record via PATCH /api/backoffice/vehicles/{id}/mailbox in the RentAVehicle API.

.PREREQUISITES
    1. Install the Exchange Online Management module:
       Install-Module ExchangeOnlineManagement -Force
    2. Connect to Exchange Online:
       Connect-ExchangeOnline -UserPrincipalName admin@yourtenant.onmicrosoft.com
    3. The app registration's service principal must have a valid mailbox or UPN
       (e.g., rentavehicle-app@contoso.com) for BookInPolicy.

.PARAMETER Make
    The vehicle's manufacturer (e.g., "Toyota").

.PARAMETER Model
    The vehicle's model name (e.g., "Camry").

.PARAMETER LicensePlate
    The vehicle's license plate number (e.g., "ABC1234").

.PARAMETER LocationName
    The location/office where the vehicle is based (e.g., "Seattle Office").

.PARAMETER AppServiceAccount
    The app registration's service principal email or UPN that will be allowed
    to create bookings on the equipment mailbox calendar (e.g., "rentavehicle-app@contoso.com").

.PARAMETER RoomListName
    Optional. The name of a room list distribution group for location-based grouping.
    If specified, the script will create the room list (if it doesn't exist) and add the
    vehicle mailbox as a member.

.EXAMPLE
    .\provision-vehicle-mailbox.ps1 -Make "Toyota" -Model "Camry" -LicensePlate "ABC1234" `
        -LocationName "Seattle Office" -AppServiceAccount "rentavehicle-app@contoso.com"

.EXAMPLE
    .\provision-vehicle-mailbox.ps1 -Make "Ford" -Model "Transit" -LicensePlate "XYZ9876" `
        -LocationName "Portland Office" -AppServiceAccount "rentavehicle-app@contoso.com" `
        -RoomListName "Portland-Vehicles"

.NOTES
    After provisioning, the script outputs the generated email address.
    Enter this email in the RentAVehicle admin panel or call:
      PATCH /api/backoffice/vehicles/{id}/mailbox
      Body: { "resourceMailboxEmail": "<generated-email>" }

    Graph API cannot create Exchange mailboxes -- this PowerShell script is the only
    supported provisioning path (see Microsoft documentation).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Make,

    [Parameter(Mandatory = $true)]
    [string]$Model,

    [Parameter(Mandatory = $true)]
    [string]$LicensePlate,

    [Parameter(Mandatory = $true)]
    [string]$LocationName,

    [Parameter(Mandatory = $true)]
    [string]$AppServiceAccount,

    [Parameter(Mandatory = $false)]
    [string]$RoomListName
)

# Generate mailbox alias: car-{make}-{model}-{licensePlate} (lowercase, alphanumeric + hyphens only)
$alias = ("car-$Make-$Model-$LicensePlate" -replace '[^a-zA-Z0-9-]', '' ).ToLower()
$displayName = "$Make $Model ($LicensePlate) - $LocationName"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "RentAVehicle - Equipment Mailbox Provisioning" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vehicle:       $Make $Model ($LicensePlate)"
Write-Host "Location:      $LocationName"
Write-Host "Alias:         $alias"
Write-Host "Display Name:  $displayName"
Write-Host "Service Acct:  $AppServiceAccount"
Write-Host ""

# Step 1: Create the equipment mailbox
Write-Host "[1/4] Creating equipment mailbox..." -ForegroundColor Yellow
try {
    New-Mailbox -Equipment -Name "$displayName" -DisplayName "$displayName" -Alias "$alias"
    Write-Host "      Equipment mailbox created successfully." -ForegroundColor Green
}
catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "      Mailbox '$alias' already exists. Continuing with configuration..." -ForegroundColor DarkYellow
    }
    else {
        Write-Error "Failed to create equipment mailbox: $_"
        exit 1
    }
}

# Step 2: Configure calendar processing
# - AutoAccept: Automatically process meeting requests
# - AllBookInPolicy $false: Reject all requests by default
# - BookInPolicy: Only the app service account can book
# - AllowConflicts $false: Prevent double-booking
Write-Host "[2/4] Configuring calendar processing..." -ForegroundColor Yellow
try {
    Set-CalendarProcessing -Identity "$alias" `
        -AutomateProcessing AutoAccept `
        -AllBookInPolicy $false `
        -BookInPolicy "$AppServiceAccount" `
        -AllowConflicts $false
    Write-Host "      Calendar processing configured." -ForegroundColor Green
    Write-Host "      - AutoAccept enabled" -ForegroundColor Gray
    Write-Host "      - Only $AppServiceAccount can book" -ForegroundColor Gray
    Write-Host "      - Conflicts disallowed" -ForegroundColor Gray
}
catch {
    Write-Error "Failed to configure calendar processing: $_"
    exit 1
}

# Step 3: Grant all organization users Reviewer access to the calendar
# This allows employees to see vehicle availability in Outlook
Write-Host "[3/4] Granting Default Reviewer access to calendar..." -ForegroundColor Yellow
try {
    Set-MailboxFolderPermission -Identity "${alias}:\Calendar" -User Default -AccessRights Reviewer
    Write-Host "      Default Reviewer access granted." -ForegroundColor Green
}
catch {
    if ($_.Exception.Message -like "*doesn't exist*") {
        # Calendar folder might not be created yet; try adding instead of setting
        try {
            Add-MailboxFolderPermission -Identity "${alias}:\Calendar" -User Default -AccessRights Reviewer
            Write-Host "      Default Reviewer access added." -ForegroundColor Green
        }
        catch {
            Write-Warning "Could not set calendar permissions. You may need to wait for mailbox provisioning to complete and retry."
            Write-Warning "Error: $_"
        }
    }
    else {
        Write-Warning "Could not set calendar permissions: $_"
    }
}

# Step 4 (Optional): Add to room list distribution group for location grouping
if ($RoomListName) {
    Write-Host "[4/4] Adding to room list '$RoomListName'..." -ForegroundColor Yellow

    # Try to create the room list (ignore error if already exists)
    try {
        New-DistributionGroup -Name $RoomListName -RoomList -ErrorAction Stop
        Write-Host "      Room list '$RoomListName' created." -ForegroundColor Green
    }
    catch {
        Write-Host "      Room list '$RoomListName' already exists or cannot be created." -ForegroundColor Gray
    }

    # Get the mailbox email to add as member
    $mailbox = Get-Mailbox -Identity "$alias" -ErrorAction SilentlyContinue
    if ($mailbox) {
        $mailboxEmail = $mailbox.PrimarySmtpAddress
        try {
            Add-DistributionGroupMember -Identity $RoomListName -Member $mailboxEmail -ErrorAction Stop
            Write-Host "      Added $mailboxEmail to room list '$RoomListName'." -ForegroundColor Green
        }
        catch {
            if ($_.Exception.Message -like "*already a member*") {
                Write-Host "      $mailboxEmail is already a member of '$RoomListName'." -ForegroundColor Gray
            }
            else {
                Write-Warning "Could not add to room list: $_"
            }
        }
    }
    else {
        Write-Warning "Could not retrieve mailbox to add to room list. Mailbox may still be provisioning."
    }
}
else {
    Write-Host "[4/4] Skipping room list (not specified)." -ForegroundColor Gray
}

# Output the generated email address
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "PROVISIONING COMPLETE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$mailbox = Get-Mailbox -Identity "$alias" -ErrorAction SilentlyContinue
if ($mailbox) {
    $email = $mailbox.PrimarySmtpAddress
    Write-Host "Resource Mailbox Email: $email" -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host ""
    Write-Host "Next step: Set this email on the vehicle in RentAVehicle:" -ForegroundColor Cyan
    Write-Host "  PATCH /api/backoffice/vehicles/{id}/mailbox" -ForegroundColor White
    Write-Host "  Body: { `"resourceMailboxEmail`": `"$email`" }" -ForegroundColor White
}
else {
    Write-Host "Mailbox created but could not retrieve email address." -ForegroundColor Yellow
    Write-Host "The mailbox may still be provisioning. Try running:" -ForegroundColor Yellow
    Write-Host "  Get-Mailbox -Identity '$alias' | Select PrimarySmtpAddress" -ForegroundColor White
}
