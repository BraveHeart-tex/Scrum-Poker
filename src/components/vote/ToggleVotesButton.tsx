'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';

import { api } from '@/convex/_generated/api';
import { ERROR_CODES } from '@/shared/errorCodes';
import { Button } from '@/src/components/ui/button';
import { showErrorToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { useRoomDetails } from '@/src/hooks/useRoomDetails';
import { ROUTES } from '@/src/lib/routes';

const ToggleVotesButton = () => {
  const roomDetails = useRoomDetails();
  const { user } = useUser();
  const router = useRouter();

  const toggleVotesRevealed = useMutation(
    api.rooms.toggleVotesRevealed
  ).withOptimisticUpdate((localStore) => {
    if (!roomDetails || !roomDetails.roomSettings) {
      return;
    }

    if (
      !roomDetails.roomSettings.allowOthersToRevealVotes &&
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
            votesRevealed: !current.room.votesRevealed,
          },
        }
      );
    }
  });

  const handleRevealVotes = async () => {
    if (!roomDetails) {
      return;
    }

    try {
      await toggleVotesRevealed({
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
          showErrorToast('Only the room creator can reveal votes.');
        },
      });
    }
  };

  return (
    <Button onClick={handleRevealVotes} className="min-w-[110px]">
      {roomDetails && roomDetails.room.votesRevealed ? 'Hide' : 'Show'} Votes
    </Button>
  );
};

export default ToggleVotesButton;
