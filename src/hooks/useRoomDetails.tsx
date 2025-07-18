'use client';

import { useUser } from '@clerk/nextjs';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { api } from '@/convex/_generated/api';
import { ERROR_CODES } from '@/shared/errorCodes';
import { showErrorToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { useQueryWithStatus } from '@/src/hooks/useQueryWithStatus';
import { ROUTES } from '@/src/lib/routes';
import { RoomPageParameters } from '@/src/types/room';

let errorHandledGlobal = false;

export const useRoomDetails = () => {
  const { code: roomCode } = useParams<RoomPageParameters>();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const { data, isError, error, isSuccess } = useQueryWithStatus(
    api.rooms.getRoomWithDetailsByCode,
    roomCode && user ? { roomCode } : 'skip'
  );

  useEffect(() => {
    if (isSuccess || !roomCode) {
      errorHandledGlobal = false;
    }
  }, [roomCode, pathname, isSuccess]);

  const handleError = useCallback(() => {
    if (!error || errorHandledGlobal) {
      return;
    }

    errorHandledGlobal = true;

    handleApplicationError(error, {
      [ERROR_CODES.UNAUTHORIZED]: () => {
        showErrorToast('You are not authorized to perform this action.');
        router.push(ROUTES.SIGN_IN);
      },
      [ERROR_CODES.VALIDATION_ERROR]: () => {
        showErrorToast('Invalid room code. Make sure the room code is valid.');
        router.push(ROUTES.HOME);
      },
      [ERROR_CODES.NOT_FOUND]: () => {
        showErrorToast('Room not found');
        router.push(ROUTES.HOME);
      },
      [ERROR_CODES.FORBIDDEN]: () => {
        showErrorToast(
          'You do not have permission to view this room. Make sure you are a participant.'
        );
        router.push(ROUTES.HOME);
      },
    });
  }, [error, router]);

  useEffect(() => {
    if (isError) {
      handleError();
    }
  }, [isError, handleError]);

  return data;
};
