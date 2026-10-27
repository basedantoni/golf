import 'dotenv/config';

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '.';
import {
  users,
  clubs,
  rounds,
  roundHoles,
  roundStats,
  roundRecommendedStats,
  userFollowedClubs,
  userPlayedClubs,
  userPostedInClubs,
} from './schema';

// Read data.json
const dataPath = join(process.cwd(), 'data.json');
const golfData = JSON.parse(readFileSync(dataPath, 'utf-8'));

const seedClubs = async () => {
  console.log('  📍 Seeding clubs...');
  const clubsToInsert = golfData.clubData.playedClubs.map((club: any) => ({
    id: club.clubId,
    name: club.name,
  }));

  for (const club of clubsToInsert) {
    await db.insert(clubs).values(club);
  }
  console.log(`  ✅ Seeded ${clubsToInsert.length} clubs`);
};

const seedUser = async () => {
  console.log('  👤 Seeding user...');
  const userData = {
    id: golfData.accountData.userId,
    name: golfData.accountData.userName,
    age: new Date().getFullYear() - (golfData.accountData.birthYear || 1990),
    email: golfData.accountData.email,
  };

  await db.insert(users).values(userData);
  console.log(`  ✅ Seeded user: ${userData.name}`);
  return userData.id;
};

const seedUserClubRelationships = async (userId: string) => {
  console.log('  🔗 Seeding user-club relationships...');

  // Followed clubs
  for (const club of golfData.clubData.followedClubs) {
    await db.insert(userFollowedClubs).values({
      userId,
      clubId: club.clubId,
    });
  }

  // Played clubs
  for (const club of golfData.clubData.playedClubs) {
    await db.insert(userPlayedClubs).values({
      userId,
      clubId: club.clubId,
    });
  }

  // Posted in clubs
  for (const club of golfData.clubData.postedInClubs) {
    await db.insert(userPostedInClubs).values({
      userId,
      clubId: club.clubId,
    });
  }

  console.log('  ✅ Seeded club relationships');
};

const seedRounds = async (userId: string) => {
  console.log('  ⛳ Seeding rounds...');
  const roundsData = golfData.activityData.rounds;

  for (const round of roundsData) {
    // Insert round
    await db.insert(rounds).values({
      id: round.id,
      userId,
      clubId: round.clubId.id,
      timestamp: round.timestamp,
      score: round.score,
      strokes: round.strokes,
    });

    // Insert hole-by-hole strokes
    for (let i = 0; i < round.holeStrokes.length; i++) {
      await db.insert(roundHoles).values({
        roundId: round.id,
        holeNumber: i + 1,
        strokes: round.holeStrokes[i],
      });
    }

    // Insert round stats
    await db.insert(roundStats).values({
      roundId: round.id,
      aces: round.stats.aces,
      doubleEagleOrBetter: round.stats.doubleEagleOrBetter,
      eagles: round.stats.eagles,
      birdies: round.stats.birdies,
      pars: round.stats.pars,
      bogeys: round.stats.bogeys,
      doubleBogeyOrWorse: round.stats.doubleBogeyOrWorse,
      fairwayLefts: round.stats.fairwayLefts,
      fairwayMiddles: round.stats.fairwayMiddles,
      fairwayRights: round.stats.fairwayRights,
      fairwayShorts: round.stats.fairwayShorts,
      fairwayLongs: round.stats.fairwayLongs,
      fairwayHoleCount: round.stats.fairwayHoleCount,
      gir: round.stats.gir,
      girLefts: round.stats.girLefts,
      girRights: round.stats.girRights,
      girShorts: round.stats.girShorts,
      girLongs: round.stats.girLongs,
      girNoChances: round.stats.girNoChances,
      girHoleCount: round.stats.girHoleCount,
      putts: round.stats.putts,
      puttHoleCount: round.stats.puttHoleCount,
      strokeGainOverall: round.stats.strokeGainOverall,
      strokeGainTeeToGreen: round.stats.strokeGainTeeToGreen,
    });

    // Insert recommended stats
    for (const recStat of round.stats.recommendedStats) {
      await db.insert(roundRecommendedStats).values({
        roundId: round.id,
        type: recStat.type,
        noStats: recStat.noStats,
        value: recStat.value,
      });
    }
  }

  console.log(`  ✅ Seeded ${roundsData.length} rounds with complete stats`);
};

export const seed = async () => {
  await seedClubs();
  const userId = await seedUser();
  await seedUserClubRelationships(userId);
  await seedRounds(userId);
};

const runSeed = async (): Promise<void> => {
  console.log('⏳ Seeding...');
  await seed();
  console.log('✅ Seeded');
};

// Only run seed if this file is executed directly
if (require.main === module) {
  runSeed().catch((err) => {
    console.error('❌ Seeding failed');
    console.error(err);
    process.exit(1);
  });
}
