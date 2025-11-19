import 'dotenv/config';

import { faker } from '@faker-js/faker';
import { db } from '.';
import { users } from './schema';

const createRandomUser = () => ({
  name: faker.person.fullName(),
  age: faker.number.int({ min: 18, max: 65 }),
  email: faker.internet.email(),
});

export const seed = async () => {
  for (const user of Array.from({ length: 100 }, createRandomUser)) {
    await db.insert(users).values(user);
  }
};

const runSeed = async (): Promise<void> => {
  console.log('⏳ Seeding...');
  await seed();
  console.log('✅ Seeded');
};

runSeed().catch((err) => {
  console.error('❌ Seeding failed');
  console.error(err);
  process.exit(1);
});
