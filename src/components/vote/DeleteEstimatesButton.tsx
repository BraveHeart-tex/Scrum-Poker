import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { api } from '@/convex/_generated/api';
import { ERROR_CODES } from '@/shared/errorCodes';
import { Button } from '@/src/components/ui/button';
import { showErrorToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { useRoomDetails } from '@/src/hooks/useRoomDetails';
import { ROUTES } from '@/src/lib/routes';

const DeleteEstimatesButton = () => {
  const roomDetails = useRoomDetails();
  const { user } = useUser();
  const router = useRouter();

  const deleteVotes = useMutation(api.votes.deleteVotes).withOptimisticUpdate(
    (localStore) => {
      if (!roomDetails) {
        return;
      }

      if (
        !roomDetails.roomSettings?.allowOthersToDeleteVotes &&
        user?.id !== roomDetails.room.ownerId
      ) {
        return;
      }

      const current = localStore.getQuery(api.rooms.getRoomWithDetailsByCode, {
        roomCode: roomDetails.room.code,
      });
      if (current) {
        localStore.setQuery(
          api.rooms.getRoomWithDetailsByCode,
          { roomCode: roomDetails.room.code },
          {
            ...current,
            room: {
              ...current.room,
              votesRevealed: false,
            },
            currentUserVote: null,
            participants: current.participants.map((participant) => ({
              ...participant,
              vote: null,
            })),
          }
        );
      }
    }
  );

  const handleDeleteEstimates = async () => {
    if (!roomDetails) {
      return;
    }
    try {
      await deleteVotes({
        roomId: roomDetails.room._id,
      });
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
          showErrorToast('Only the room creator can delete estimates.');
        },
      });
    }
  };

  const roomHasVotes: boolean = useMemo(() => {
    if (!roomDetails) {
      return false;
    }

    return roomDetails.participants.some((participant) => participant.vote);
  }, [roomDetails]);

  return (
    <Button
      onClick={handleDeleteEstimates}
      disabled={!roomHasVotes}
      variant="outline"
    >
      Delete Estimates
    </Button>
  );
};
export default DeleteEstimatesButton;
