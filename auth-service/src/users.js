import bcrypt from 'bcryptjs';

const users = [
  {
    id: 'u1',
    email: 'demo@example.com',
    passwordHash: bcrypt.hashSync('password123', 10),
    role: 'user',
    name: 'Demo User',
  },
];

export function findUserByEmail(email) {
  if (!email) return null;
  return users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

export function getUserById(id) {
  if (!id) return null;
  return users.find(u => u.id === id) || null;
}

export async function verifyPassword(user, password) {
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}