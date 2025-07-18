import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { ApplicationError, ERROR_CODES } from '../shared/errorCodes';
import { generateRoomCode, isValidRoomCode } from '../shared/generateRoomCode';
import { api } from './_generated/api';
import { Doc as Document_ } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getUserNameFromIdentity } from './helpers';

export const createRoom = mutation({
  args: {
    roomName: v.string(),
    userDisplayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: "'Must be logged in to create a room'",
      });
    }

    let roomCode: string;
    let exists;

    do {
      roomCode = generateRoomCode();
      exists = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q) => q.eq('code', roomCode))
        .unique();
    } while (exists);

    const roomId = await ctx.db.insert('rooms', {
      name: args.roomName,
      ownerId: userIdentity.userId as string,
      votesRevealed: false,
      code: roomCode,
      locked: false,
    });

    await ctx.db.insert('roomSettings', {
      roomId,
      allowOthersToRevealVotes: true,
      allowOthersToDeleteVotes: true,
      showAverageOfVotes: true,
      showUserPresence: true,
    });

    // add the user as the participant of the room
    await ctx.db.insert('participants', {
      userId: userIdentity.userId as string,
      isActive: true,
      userName: args.userDisplayName || getUserNameFromIdentity(userIdentity),
      roomId,
    });

    return {
      roomId,
      roomCode,
    };
  },
});

export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    userDisplayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userIdentity = await ctx.auth.getUserIdentity();

    if (userIdentity === null) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Must be logged in to join a room',
      });
    }

    if (!isValidRoomCode(args.roomCode)) {
      throw new ApplicationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid room code',
      });
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', args.roomCode))
      .unique();
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    // Check if the user is already a participant
    const existingParticipant = await ctx.db
      .query('participants')
      .withIndex('by_room_and_user', (query) =>
        query.eq('roomId', room._id).eq('userId', userIdentity.userId as string)
      )
      .unique();

    if (existingParticipant) {
      await ctx.db.patch(existingParticipant._id, { isActive: true });
    } else {
      if (room.locked) {
        throw new ApplicationError({
          code: ERROR_CODES.FORBIDDEN,
          message: 'Room is currently locked. Please try again later.',
        });
      }

      await ctx.db.insert('participants', {
        roomId: room._id,
        userId: userIdentity.userId as string,
        isActive: true,
        userName: args.userDisplayName || getUserNameFromIdentity(userIdentity),
      });
    }

    return {
      roomId: room._id,
      roomCode: room.code,
    };
  },
});

export const getRoomWithDetailsByCode = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    const currentUserId = userIdentity?.userId as string | undefined;
    if (!currentUserId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Must be logged in to perform this action',
      });
    }

    if (!isValidRoomCode(args.roomCode)) {
      throw new ApplicationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid room code',
      });
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', args.roomCode))
      .unique();

    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    const isParticipant = await ctx.db
      .query('participants')
      .withIndex('by_room_and_user', (q) =>
        q.eq('roomId', room._id).eq('userId', currentUserId)
      )
      .unique();

    if (!isParticipant) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Must be a room participant to perform this action',
      });
    }

    const [participants, roomSettings, votes] = await Promise.all([
      await ctx.db
        .query('participants')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect(),
      await ctx.db
        .query('roomSettings')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .unique(),
      await ctx.db
        .query('votes')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect(),
    ]);

    return {
      room,
      participants: participants.map((participant) => ({
        ...participant,
        isOwner: participant.userId === room.ownerId,
        vote: votes.find((vote) => vote.userId === participant.userId)?.value,
      })),
      roomSettings,
      currentUserVote: votes.find((vote) => vote.userId === currentUserId)
        ?.value,
    };
  },
});

export const getUserRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const participations = await ctx.db
      .query('participants')
      .filter((q) => q.eq(q.field('userId'), userId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    const rooms: Document_<'rooms'>[] = [];
    for (const participation of participations) {
      const room = await ctx.db.get(participation.roomId);
      if (room) {
        rooms.push(room);
      }
    }

    return rooms;
  },
});

export const toggleVotesRevealed = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Must be logged in to reveal voting',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    const roomSettings = await ctx.runQuery(
      api.roomSettings.getRoomSettingsByRoomId,
      {
        roomId: args.roomId,
      }
    );

    if (!roomSettings.allowOthersToRevealVotes && room.ownerId !== userId) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the room creator can reveal votes',
      });
    }

    await ctx.db.patch(args.roomId, {
      votesRevealed: !room.votesRevealed,
    });
  },
});

export const resetVoting = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Must be logged in',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    if (room.ownerId !== userId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Only room creator can reset voting',
      });
    }

    // Clear votes
    const votes = await ctx.db
      .query('votes')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();

    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.patch(args.roomId, {
      votesRevealed: false,
    });
  },
});

export const deleteRoom = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Must be logged in',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    if (room.ownerId !== userId) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only room creator can delete room',
      });
    }

    await ctx.db.delete(args.roomId);
  },
});

export const transferRoomOwnership = mutation({
  args: {
    roomId: v.id('rooms'),
    newOwnerId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must be logged in to transfer ownership',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    if (room.ownerId !== userId) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the room creator can transfer ownership',
      });
    }

    const isNewOwnerParticipant = await ctx.db
      .query('participants')
      .withIndex('by_room_and_user', (q) =>
        q.eq('roomId', args.roomId).eq('userId', args.newOwnerId)
      )
      .unique();

    if (!isNewOwnerParticipant) {
      throw new ApplicationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'New owner must be a room participant',
      });
    }

    await ctx.db.patch(args.roomId, {
      ownerId: args.newOwnerId,
    });
  },
});

export const banUser = mutation({
  args: {
    roomId: v.id('rooms'),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must be logged in to perform this action',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    if (room.ownerId !== userIdentity.userId) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the room creator can ban users',
      });
    }

    const participant = await ctx.db
      .query('participants')
      .withIndex('by_room_and_user', (q) =>
        q.eq('roomId', args.roomId).eq('userId', args.userId)
      )
      .unique();

    if (!participant) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User not found in room',
      });
    }

    // TODO:We also have to delete votes and other entities
    // associated with the user, but will probably handle them
    // in a scheduled function
    await Promise.all([
      ctx.db.insert('bannedUsers', {
        roomId: args.roomId,
        userId: args.userId,
        reason: args.reason,
        bannedAt: Date.now(),
        bannedBy: userIdentity.userId,
      }),
      ctx.db.delete(participant._id),
    ]);
  },
});

export const toggleRoomLock = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx, args) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new ApplicationError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must be logged in to perform this action',
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ApplicationError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Room not found',
      });
    }

    if (room.ownerId !== userIdentity.userId) {
      throw new ApplicationError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the room owner can toggle the room lock',
      });
    }

    await ctx.db.patch(args.roomId, {
      locked: !room.locked,
    });
  },
});
