'use client';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { api } from '@/convex/_generated/api';
import { ERROR_CODES } from '@/shared/errorCodes';
import { showErrorToast } from '@/src/components/ui/sonner';
import VoteCard from '@/src/components/vote/VoteCard';
import { VOTE_OPTIONS } from '@/src/constants/vote.constants';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { useRoomDetails } from '@/src/hooks/useRoomDetails';
import { ROUTES } from '@/src/lib/routes';
import { RoomPageParameters } from '@/src/types/room';
import { VoteOption } from '@/src/types/voteOption';

const VoteCards = () => {
  const router = useRouter();
  const roomPageParameters = useParams<RoomPageParameters>();
  const roomDetails = useRoomDetails();
  const { user } = useUser();
  const castVote = useMutation(api.votes.castVote).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.rooms.getRoomWithDetailsByCode, {
        roomCode: roomPageParameters.code,
      });
      if (current && user) {
        localStore.setQuery(
          api.rooms.getRoomWithDetailsByCode,
          { roomCode: roomPageParameters.code },
          {
            ...current,
            currentUserVote: args.value,
            participants: current.participants.map((participant) =>
              participant.userId === user.id
                ? { ...participant, vote: args.value }
                : participant
            ),
          }
        );
      }
    }
  );

  const handleVote = useCallback(
    async (option: VoteOption) => {
      if (!roomDetails?.room) {
        return;
      }

      try {
        await castVote({ roomId: roomDetails.room._id, value: option.value });
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
            showErrorToast('You must be a room participant to vote.');
          },
        });
      }
    },
    [castVote, roomDetails?.room, router]
  );

  return (
    <div className="flex max-w-screen-sm flex-wrap items-center justify-center gap-2">
      {VOTE_OPTIONS.map((option) => (
        <VoteCard
          key={option.value}
          option={option}
          isSelected={option.value === roomDetails?.currentUserVote}
          onClick={handleVote}
        />
      ))}
    </div>
  );
};

export default VoteCards;
