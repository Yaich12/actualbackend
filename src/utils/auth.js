import { auth } from '../firebase';

export const getIdToken = async () => {
  if (!auth.currentUser) {
    throw new Error('No authenticated user');
  }
  return auth.currentUser.getIdToken();
};
