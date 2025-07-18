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
  AlertDialogTrigger,
} from '@/src/components/ui/alert-dialog';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { showErrorToast, showSuccessToast } from '@/src/components/ui/sonner';
import { Textarea } from '@/src/components/ui/textarea';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { ROUTES } from '@/src/lib/routes';
import { CommonDialogProps } from '@/src/types/dialog';

interface BanUserDialogProps extends CommonDialogProps {
  userName: string;
  userId: string;
  roomId: Id<'rooms'>;
}

const BAN_USER_REASON_MAX_LENGTH = 200;

const BanUserDialog = ({
  isOpen,
  onOpenChange,
  roomId,
  userId,
  userName,
}: BanUserDialogProps) => {
  const [isBanning, setIsBanning] = useState(false);
  const [reason, setReason] = useState('');
  const banUser = useMutation(api.rooms.banUser);
  const router = useRouter();

  const handleBanUser = async () => {
    setIsBanning(true);
    try {
      await banUser({ roomId, userId, reason });
      showSuccessToast('User banned successfully!');
      onOpenChange(false);
    } catch (error) {
      handleApplicationError(error, {
        [ERROR_CODES.UNAUTHORIZED]: () => {
          showErrorToast('You are not authorized to perform this action.');
          router.push(ROUTES.SIGN_IN);
        },
        [ERROR_CODES.NOT_FOUND]: () => {
          showErrorToast('Room or user not found');
        },
        [ERROR_CODES.FORBIDDEN]: () => {
          showErrorToast('Only the room creator can ban users.');
        },
      });
    } finally {
      setIsBanning(false);
    }
  };

  const handleReasonChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setReason(event.target.value);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger>Open</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to ban &quot;{userName}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They won’t be able to rejoin this room in the future.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex w-full flex-col gap-2 overflow-y-auto">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            name="reason"
            value={reason}
            onChange={handleReasonChange}
            maxLength={BAN_USER_REASON_MAX_LENGTH}
          />
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Optional reason for banning the user.
            </p>
            <p className="text-muted-foreground text-xs">
              {reason.length}/{BAN_USER_REASON_MAX_LENGTH}
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleBanUser}
            disabled={isBanning}
            isLoading={isBanning}
          >
            {isBanning ? 'Banning' : 'Ban'} User
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BanUserDialog;
