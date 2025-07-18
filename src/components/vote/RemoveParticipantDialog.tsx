'use client';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { ERROR_CODES } from '@/shared/errorCodes';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import { Button } from '@/src/components/ui/button';
import { showErrorToast, showSuccessToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { ROUTES } from '@/src/lib/routes';
import { CommonDialogProps } from '@/src/types/dialog';

interface RemoveParticipantDialogProps extends CommonDialogProps {
  userName: string;
  participantId: Id<'participants'>;
}

const RemoveParticipantDialog = ({
  isOpen,
  onOpenChange,
  userName,
  participantId,
}: RemoveParticipantDialogProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const removeParticipant = useMutation(
    api.participants.removeParticipantFromRoom
  );
  const router = useRouter();

  const handleRemoveParticipant = async () => {
    setIsRemoving(true);
    try {
      await removeParticipant({
        participantId,
      });
      showSuccessToast('Participant removed successfully!');
      onOpenChange(false);
    } catch (error) {
      handleApplicationError(error, {
        [ERROR_CODES.UNAUTHORIZED]: () => {
          showErrorToast('You are not authorized to perform this action.');
          router.push(ROUTES.SIGN_IN);
        },
        [ERROR_CODES.NOT_FOUND]: () => {
          showErrorToast('Room or participant not found');
        },
        [ERROR_CODES.FORBIDDEN]: () => {
          showErrorToast('Only the room creator can remove participants.');
        },
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to remove &quot;{userName}&quot; from the
            room?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isRemoving}
            isLoading={isRemoving}
            onClick={handleRemoveParticipant}
          >
            {isRemoving ? 'Removing' : 'Remove'} Participant
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveParticipantDialog;
