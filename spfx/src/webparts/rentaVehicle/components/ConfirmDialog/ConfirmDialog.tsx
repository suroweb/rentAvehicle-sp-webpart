import * as React from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
} from '@fluentui/react/lib/Dialog';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';

export interface IConfirmDialogProps {
  hidden: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ConfirmDialog: React.FC<IConfirmDialogProps> = ({
  hidden,
  title,
  message,
  confirmLabel,
  onConfirm,
  onDismiss,
}) => {
  const dialogContentProps = React.useMemo(
    () => ({
      type: DialogType.normal,
      title,
      subText: message,
    }),
    [title, message]
  );

  const modalProps = React.useMemo(
    () => ({
      isBlocking: true,
      styles: { main: { maxWidth: 450 } },
    }),
    []
  );

  return (
    <Dialog
      hidden={hidden}
      onDismiss={onDismiss}
      dialogContentProps={dialogContentProps}
      modalProps={modalProps}
    >
      <DialogFooter>
        <PrimaryButton onClick={onConfirm} text={confirmLabel} />
        <DefaultButton onClick={onDismiss} text="Cancel" />
      </DialogFooter>
    </Dialog>
  );
};
