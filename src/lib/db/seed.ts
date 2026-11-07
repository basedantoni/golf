import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '.';
import {
  users,
  clubs,
  courseHoles,
  rounds,
  roundHoles,
  roundStats,
  roundRecommendedStats,
  userFollowedClubs,
  userPlayedClubs,
  userPostedInClubs,
} from './schema';
import { parsForRound, type CourseParEntry } from './round-pars';
import coursePars from './course-pars.json';

// Read data.json
const dataPath = join(process.cwd(), 'data.json');
const golfData = JSON.parse(readFileSync(dataPath, 'utf-8'));
const courseParEntry = (clubId: string) => (coursePars as Record<string, CourseParEntry>)[clubId];

const seedClubs = async () => {
  console.log('  📍 Seeding clubs...');
  const clubsToInsert = golfData.clubData.playedClubs.map((club: { clubId: string; name: string }) => ({
    id: club.clubId,
    name: club.name,
  }));

  for (const club of clubsToInsert) {
    await db.insert(clubs).values(club);
  }
  console.log(`  ✅ Seeded ${clubsToInsert.length} clubs`);
};

// course-pars.json is the seed input for Usual Pars; the app reads course_holes. See ADR 0002.
const seedCourseHoles = async () => {
  console.log('  🕳️  Seeding course holes...');
  const entries = Object.entries(coursePars as Record<string, CourseParEntry>);
  for (const [clubId, entry] of entries) {
    await db.insert(courseHoles).values(
      entry.pars.map((par, i) => ({
        clubId,
        holeNumber: i + 1,
        par,
        variantPars: entry.variants?.[i + 1] ?? null,
      })),
    );
  }
  console.log(`  ✅ Seeded holes for ${entries.length} courses`);
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

    // Insert hole-by-hole strokes, with the Par each hole played to
    const course = courseParEntry(round.clubId.id);
    if (!course) console.warn(`  ⚠️  No course-pars.json entry for club ${round.clubId.id}`);
    const pars = course
      ? parsForRound(course, round.holeStrokes.length, round.strokes - round.score)
      : [];
    if (course && !course.pars.includes(null) && pars.every((p) => p === null)) {
      console.warn(`  ⚠️  ${course.name}: no par layout matches round ${round.id} (par ${round.strokes - round.score})`);
    }
    for (let i = 0; i < round.holeStrokes.length; i++) {
      await db.insert(roundHoles).values({
        roundId: round.id,
        holeNumber: i + 1,
        strokes: round.holeStrokes[i],
        par: pars[i] ?? null,
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
      // Source export reports puttHoleCount 0 even when putts were tracked;
      // fall back to the round's hole count so puttsPerRound can normalize.
      puttHoleCount:
        round.stats.puttHoleCount ||
        (round.stats.putts > 0 ? round.holeStrokes.length : 0),
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
  await seedCourseHoles();
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
