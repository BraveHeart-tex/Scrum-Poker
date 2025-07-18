'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '@/convex/_generated/api';
import { ERROR_CODES } from '@/shared/errorCodes';
import { ROOM_CODE_DEFAULT_SIZE } from '@/shared/generateRoomCode';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { showErrorToast } from '@/src/components/ui/sonner';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { ROUTES } from '@/src/lib/routes';
import {
  JoinRoomInput,
  joinRoomSchema,
} from '@/src/validation/join-room.schema';

const JoinRoomDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const joinRoom = useMutation(api.rooms.joinRoom);
  const form = useForm<JoinRoomInput>({
    defaultValues: {
      roomCode: '',
      userDisplayName: '',
    },
    resolver: zodResolver(joinRoomSchema),
  });
  const router = useRouter();

  const onSubmit = async (data: JoinRoomInput) => {
    setIsJoining(true);

    try {
      const result = await joinRoom(data);
      router.push(ROUTES.ROOM(result.roomCode));
    } catch (error) {
      return handleApplicationError(error, {
        [ERROR_CODES.UNAUTHORIZED]: () => {
          router.push(ROUTES.SIGN_IN);
        },
        [ERROR_CODES.VALIDATION_ERROR]: () => {
          showErrorToast(
            'Invalid room code. Make sure the room code is valid.'
          );
        },
        [ERROR_CODES.NOT_FOUND]: () => {
          showErrorToast('Room not found');
        },
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }

    setIsOpen(isOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">Join Room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Room</DialogTitle>
          <DialogDescription>
            Enter your room code to get started. Add your name if you’d like
            others to see it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="roomCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`${ROOM_CODE_DEFAULT_SIZE} character code`}
                      maxLength={ROOM_CODE_DEFAULT_SIZE}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    If you don&apos;t know the room code, please ask the room
                    owner.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userDisplayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional: Change your name in the room
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isJoining} isLoading={isJoining}>
                {isJoining ? 'Joining' : 'Join Room'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default JoinRoomDialog;
