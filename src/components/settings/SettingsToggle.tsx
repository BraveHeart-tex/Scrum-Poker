'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { ERROR_CODES } from '@/shared/errorCodes';
import { Label } from '@/src/components/ui/label';
import { showErrorToast } from '@/src/components/ui/sonner';
import { Switch } from '@/src/components/ui/switch';
import { handleApplicationError } from '@/src/helpers/handleApplicationError';
import { ROUTES } from '@/src/lib/routes';
import { RoomSettingKey } from '@/src/types/room';

interface SettingsToggleProps {
  label: string;
  settingKey: RoomSettingKey;
  checked: boolean;
  roomSettingId: Id<'roomSettings'>;
  roomCode: string;
}

const SettingsToggle = ({
  settingKey,
  checked,
  label,
  roomSettingId,
  roomCode,
}: SettingsToggleProps) => {
  const router = useRouter();
  const updateRoomSettings = useMutation(
    api.roomSettings.updateRoomSettings
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.rooms.getRoomWithDetailsByCode, {
      roomCode,
    });
    if (current && current.roomSettings) {
      localStore.setQuery(
        api.rooms.getRoomWithDetailsByCode,
        { roomCode },
        {
          ...current,
          roomSettings: {
            ...current.roomSettings,
            [settingKey]: args[settingKey],
          },
        }
      );
    }
  });
  const handleCheckedChange = async (isChecked: boolean) => {
    try {
      await updateRoomSettings({
        roomSettingId,
        [settingKey]: isChecked,
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
          showErrorToast(
            'You do not have permission to update the room settings.'
          );
        },
      });
    }
  };

  return (
    <div className="flex w-full items-center justify-between">
      <Label htmlFor={settingKey}>{label}</Label>
      <Switch
        id={settingKey}
        name={settingKey}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    </div>
  );
};

export default SettingsToggle;
