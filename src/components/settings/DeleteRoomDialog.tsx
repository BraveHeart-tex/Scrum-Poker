import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/convex/_generated/api';
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
import { Input } from '@/src/components/ui/input';
import { showErrorToast, showSuccessToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { useRoomDetails } from '@/src/hooks/useRoomDetails';
import { ROUTES } from '@/src/lib/routes';
import { CommonDialogProps } from '@/src/types/dialog';
import { RoomPageParameters } from '@/src/types/room';

const DeleteRoomDialog = ({ isOpen, onOpenChange }: CommonDialogProps) => {
  const [enteredCode, setEnteredCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const roomCode = useParams<RoomPageParameters>().code;
  const roomDetails = useRoomDetails();
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const router = useRouter();
  const { user } = useUser();

  if (!roomDetails || user?.id !== roomDetails.room.ownerId) {
    return null;
  }

  const handleRoomCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEnteredCode(event.target.value);
  };

  const handleDeleteRoom = async () => {
    setIsDeleting(true);
    try {
      await deleteRoom({ roomId: roomDetails.room._id });
      router.push(ROUTES.HOME);
      showSuccessToast('Room deleted successfully!');
      onOpenChange(false);
    } catch (error) {
      handleApplicationError(error, {
        [ERROR_CODES.UNAUTHORIZED]: () => {
          showErrorToast('You are not authorized to perform this action.');
          router.push(ROUTES.SIGN_IN);
        },
        [ERROR_CODES.NOT_FOUND]: () => {
          showErrorToast('Room not found');
          router.push(ROUTES.HOME);
        },
        [ERROR_CODES.FORBIDDEN]: () => {
          showErrorToast('Only the room creator can delete the room.');
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && enteredCode === roomCode) {
      handleDeleteRoom();
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setEnteredCode('');
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this room?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            To confirm, please type the room code:
            <span className="text-foreground bg-muted ml-2 inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium tracking-wide">
              {roomCode}
            </span>
          </p>
          <Input
            type="text"
            placeholder="Enter room code"
            className="w-full"
            value={enteredCode}
            onChange={handleRoomCodeChange}
            maxLength={roomCode.length}
            disabled={isDeleting}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={enteredCode !== roomCode || isDeleting}
            variant="destructive"
            onClick={handleDeleteRoom}
            isLoading={isDeleting}
          >
            {isDeleting ? 'Deleting' : 'Delete'} Room
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteRoomDialog;
