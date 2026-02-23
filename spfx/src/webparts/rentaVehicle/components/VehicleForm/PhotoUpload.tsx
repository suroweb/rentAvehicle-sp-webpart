import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';

export interface IPhotoUploadProps {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// TODO: For production, replace base64 data URL storage with Azure Blob Storage
// using the Valet Key pattern (SAS tokens) for secure, scalable image hosting.
// See: https://learn.microsoft.com/en-us/azure/architecture/patterns/valet-key

export const PhotoUpload: React.FC<IPhotoUploadProps> = ({ photoUrl, onChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const handleFileSelect = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(undefined);

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('Photo must be smaller than 2MB. Please choose a smaller image.');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Convert to base64 data URL for Phase 2 storage
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>): void => {
        const dataUrl = e.target?.result as string;
        onChange(dataUrl);
      };
      reader.onerror = (): void => {
        setError('Failed to read the image file. Please try again.');
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleUploadClick = React.useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleRemovePhoto = React.useCallback((): void => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(undefined);
  }, [onChange]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          color: '#323130',
          marginBottom: 8,
        }}
      >
        Vehicle Photo
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Photo preview or placeholder */}
        <div
          style={{
            width: 120,
            height: 90,
            borderRadius: 4,
            border: '1px solid #edebe9',
            backgroundColor: '#faf9f8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Vehicle photo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Icon
              iconName="Camera"
              styles={{
                root: {
                  fontSize: 32,
                  color: '#a19f9d',
                },
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton
            text={photoUrl ? 'Change Photo' : 'Upload Photo'}
            iconProps={{ iconName: 'Upload' }}
            onClick={handleUploadClick}
          />
          {photoUrl && (
            <DefaultButton
              text="Remove Photo"
              iconProps={{ iconName: 'Delete' }}
              onClick={handleRemovePhoto}
            />
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginTop: 8 } }}
        >
          {error}
        </MessageBar>
      )}
    </div>
  );
};
