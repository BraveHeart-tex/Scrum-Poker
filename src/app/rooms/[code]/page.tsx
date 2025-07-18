import { auth } from '@clerk/nextjs/server';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { isValidRoomCode } from '@/shared/generateRoomCode';
import RoomPageClient from '@/src/components/room/RoomPageClient';
import { ROUTES } from '@/src/lib/routes';
import { RoomPageParameters } from '@/src/types/room';

interface RoomPageProps {
  params: Promise<RoomPageParameters>;
}

export async function generateMetadata({
  params,
}: RoomPageProps): Promise<Metadata> {
  const { code } = await params;

  return {
    title: `Scrum Poker | Room ${code}`,
  };
}

const RoomPage = async ({ params }: RoomPageProps) => {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    redirect(ROUTES.SIGN_IN);
  }

  if (!isValidRoomCode((await params).code)) {
    redirect(ROUTES.HOME);
  }

  return <RoomPageClient roomCode={(await params).code} />;
};

export default RoomPage;
