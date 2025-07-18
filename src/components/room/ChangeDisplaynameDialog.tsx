'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { PencilIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { ERROR_CODES } from '@/shared/errorCodes';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { showErrorToast, showSuccessToast } from '@/src/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/ui/tooltip';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { ROUTES } from '@/src/lib/routes';
import {
  ChangeDisplayNameInput,
  changeDisplayNameSchema,
} from '@/src/validation/change-display-name.schema';

interface ChangeDisplaynameDialogProps {
  defaultValue: string;
  participantId: Id<'participants'>;
}

const ChangeDisplaynameDialog = ({
  defaultValue,
  participantId,
}: ChangeDisplaynameDialogProps) => {
  const [isChanging, setIsChanging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<ChangeDisplayNameInput>({
    defaultValues: {
      userDisplayName: defaultValue,
    },
    resolver: zodResolver(changeDisplayNameSchema),
  });
  const changeDisplayName = useMutation(api.participants.changeDisplayName);

  const handleOpenChange = (isOpen: boolean) => {
    setIsOpen(isOpen);
    if (!isOpen) {
      form.reset({ userDisplayName: defaultValue });
    }
  };

  const onSubmit = async (data: ChangeDisplayNameInput) => {
    setIsChanging(true);
    try {
      await changeDisplayName({
        displayName: data.userDisplayName,
        participantId,
      });
      showSuccessToast('Display name changed successfully!');
      setIsOpen(false);
    } catch (error) {
      handleApplicationError(error, {
        [ERROR_CODES.UNAUTHORIZED]: () => {
          showErrorToast('You are not authorized to perform this action.');
          redirect(ROUTES.SIGN_IN);
        },
        [ERROR_CODES.NOT_FOUND]: () => {
          redirect(ROUTES.HOME);
        },
        [ERROR_CODES.FORBIDDEN]: () => {
          showErrorToast('You are not to perform this action.');
        },
        [ERROR_CODES.CONFLICT]: () => {
          showErrorToast(
            'Display name already taken. Please try another name.'
          );
        },
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild onClick={() => setIsOpen(true)}>
            <Button
              size="icon"
              variant="outline"
              className="ml-2 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <PencilIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Change your display name</p>
          </TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your display name</DialogTitle>
          <DialogDescription>
            Use the form below to change your display name in this room.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userDisplayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  isChanging || defaultValue === form.watch('userDisplayName')
                }
                isLoading={isChanging}
              >
                {isChanging ? 'Saving' : 'Save'} changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeDisplaynameDialog;
