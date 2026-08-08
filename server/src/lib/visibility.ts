import { prisma } from "./prisma.js";
import type { Prisma } from "@prisma/client";


export const FRIEND_VISIBILITY_HOURS = 5;

export function friendVisibleFlightWhere(): Prisma.FlightWhereInput {
  const cutoff = new Date(Date.now() - FRIEND_VISIBILITY_HOURS * 3600_000);
  return {
    OR: [
      { status: { in: ["SCHEDULED", "ACTIVE", "DIVERTED", "UNKNOWN"] } },
      // Landed recently: judge by best-known arrival time.
      {
        status: "LANDED",
        OR: [
          { actualArr: { gte: cutoff } },
          { actualArr: null, schedArr: { gte: cutoff } },
          // No times at all keep visible;

          { actualArr: null, schedArr: null },
        ],
      },
    ],
  };
}

/** IDs of users with an ACCEPTED friendship with `userId`, either direction. */
export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** True if `viewerId` may see flights owned by `ownerId`. */
export async function canViewFlightsOf(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: viewerId, addresseeId: ownerId },
        { requesterId: ownerId, addresseeId: viewerId },
      ],
    },
  });
  return Boolean(friendship);
}
